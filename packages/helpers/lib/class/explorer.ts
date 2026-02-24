import {
  Node,
  SourceFile,
  createSourceFile,
  ScriptTarget,
  ScriptKind,
  TypeAliasDeclaration,
  VariableStatement,
  FunctionDeclaration,
  SyntaxKind,
  Identifier,
  ArrowFunction,
  FunctionExpression,
  InterfaceDeclaration,
  ClassDeclaration,
  MethodDeclaration,
  PropertyDeclaration,
  TypeElement,
  NodeArray,
  isSourceFile,
  isVariableStatement,
  isParameter,
  isPropertyDeclaration,
  isTypeAliasDeclaration,
  isFunctionDeclaration,
  isMethodDeclaration,
  isArrowFunction,
  isFunctionExpression,
  isClassDeclaration,
  isInterfaceDeclaration,
  isIdentifier,
  isPropertySignature,
  isTypeLiteralNode,
} from "typescript";

function createSource(source: string): SourceFile {
  return createSourceFile(
    "inline.ts",
    source,
    ScriptTarget.Latest,
    true,
    ScriptKind.TS,
  );
}

function createTree(
  code: string,
  kind:
    | SyntaxKind.TypeReference
    | SyntaxKind.MethodDeclaration
    | SyntaxKind.Unknown = SyntaxKind.Unknown,
): Node | null {
  if (!code.trim()) {
    return null;
  }

  let sourceFile: SourceFile;

  if (kind === SyntaxKind.MethodDeclaration) {
    sourceFile = createSource(`class _ { ${code} }`);
    const classDecl = sourceFile.statements[0] as ClassDeclaration;
    const methodDecl = classDecl.members.find((member) =>
      isMethodDeclaration(member),
    );
    return methodDecl || null;
  }

  if (kind === SyntaxKind.TypeReference) {
    sourceFile = createSource(`let _: ${code};`);
    const varStatement = sourceFile.statements[0] as VariableStatement;
    const declaration = varStatement.declarationList.declarations[0];
    return declaration.type || null;
  }

  sourceFile = createSource(code);
  return sourceFile.statements.length === 1
    ? sourceFile.statements[0]
    : sourceFile;
}

const removeSemicolons = (nodes: readonly Node[]): Node[] =>
  nodes.filter(({ kind }) => kind !== SyntaxKind.SemicolonToken);

const areNodesEquivalent = (
  node1: Node | null,
  node2: Node | null,
): boolean => {
  if (node1 === null && node2 === null) return true;
  if (node1 === null || node2 === null) return false;
  if (node1.kind !== node2.kind) return false;

  const children1 = removeSemicolons(node1.getChildren());
  const children2 = removeSemicolons(node2.getChildren());

  if (children1.length === 0 && children2.length === 0) {
    // Leaf node - compare text content
    return node1.getText() === node2.getText();
  }

  if (children1.length !== children2.length) return false;

  for (let i = 0; i < children1.length; i++) {
    if (!areNodesEquivalent(children1[i], children2[i])) {
      return false;
    }
  }

  return true;
};

class Explorer {
  private tree: Node | null;

  constructor(
    tree: Node | string = "",
    syntaxKind:
      | SyntaxKind.TypeReference
      | SyntaxKind.MethodDeclaration
      | SyntaxKind.Unknown = SyntaxKind.Unknown,
  ) {
    this.tree = typeof tree === "string" ? createTree(tree, syntaxKind) : tree;
  }

  isEmpty(): boolean {
    return this.tree === null;
  }

  toString(): string {
    return this.tree ? this.tree.getText() : "no ast";
  }

  // Compares the current tree with another tree, ignoring semicolons and whitespace
  matches(other: string | Explorer): boolean {
    let otherExplorer: Explorer;

    if (typeof other === "string") {
      // If current node is a MethodDeclaration, wrap the string in a class for proper parsing
      if (this.tree && isMethodDeclaration(this.tree)) {
        otherExplorer = new Explorer(other, SyntaxKind.MethodDeclaration);
      } else {
        otherExplorer = new Explorer(other);
      }
    } else {
      otherExplorer = other;
    }

    return areNodesEquivalent(this.tree, otherExplorer.tree);
  }

  // Finds all nodes of a specific kind in the tree
  getAll(kind: SyntaxKind): Explorer[] {
    if (!this.tree) {
      return [];
    }

    const nodes: Explorer[] = [];

    // Check if the tree is a SourceFile or a single node
    if (isSourceFile(this.tree)) {
      // Iterate through the statements of the SourceFile
      this.tree.statements.forEach((statement) => {
        if (statement.kind === kind) {
          nodes.push(new Explorer(statement));
        }
      });
    }

    // If the root is a single node, check if it matches the kind
    if (this.tree?.kind === kind) {
      nodes.push(new Explorer(this.tree));
    }

    return nodes;
  }

  // Finds all variable statements
  getVariables(): Explorer[] {
    return this.getAll(SyntaxKind.VariableStatement);
  }

  // Finds a variable by name, excluding function declarations
  findVariable(name: string): Explorer {
    const variables = this.getVariables();
    const cb = (v: Explorer) =>
      (
        (v.tree as VariableStatement).declarationList.declarations[0]
          .name as Identifier
      ).text === name;
    return variables.find(cb) ?? new Explorer();
  }

  // Checks if a variable with the given name exists in the current tree
  hasVariable(name: string): boolean {
    return !this.findVariable(name).isEmpty();
  }

  // Retrieves the type annotation of the current node if it exists, otherwise returns an empty Explorer
  getAnnotation(): Explorer {
    if (this.isEmpty()) {
      return new Explorer();
    }

    const node = this.tree!;

    // Handle VariableStatement (variable declarations)
    if (isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0];
      if (declaration.type) {
        return new Explorer(declaration.type);
      }
    }

    // Handle Parameter (function/method parameters), PropertyDeclaration (class
    // properties), and TypeAliasDeclaration (the type itself)
    if (
      isParameter(node) ||
      isPropertyDeclaration(node) ||
      isTypeAliasDeclaration(node)
    ) {
      if (node.type) {
        return new Explorer(node.type);
      }
    }

    return new Explorer();
  }

  // Checks if the current node has a type annotation that matches the provided annotation string
  hasAnnotation(annotation: string): boolean {
    const currentAnnotation = this.getAnnotation();
    if (currentAnnotation.isEmpty()) {
      return false;
    }

    const annotationNode = createTree(annotation, SyntaxKind.TypeReference);
    if (annotationNode === null) {
      return false;
    }

    const annotationExplorer = new Explorer(annotationNode);
    return currentAnnotation.matches(annotationExplorer);
  }

  // Finds all functions in the current tree. If withVariables is true, it includes function expressions and arrow functions assigned to variables
  getFunctions(withVariables: boolean = false): Explorer[] {
    const functionDeclarations = this.getAll(SyntaxKind.FunctionDeclaration);
    if (!withVariables) {
      return functionDeclarations;
    }

    const variableStatements = this.getAll(SyntaxKind.VariableStatement);
    const functionVariables = variableStatements.filter((v) => {
      const declaration = (v.tree as VariableStatement).declarationList
        .declarations[0];
      if (!declaration.initializer) return false;

      return (
        isArrowFunction(declaration.initializer) ||
        isFunctionExpression(declaration.initializer)
      );
    });
    return [...functionDeclarations, ...functionVariables];
  }

  // Finds a function by name, checking function declarations, variable statements with functions, and method declarations
  // If withVariables is true, it includes function expressions and arrow functions assigned to variables
  findFunction(name: string, withVariables: boolean = false): Explorer {
    const functions = this.getFunctions(withVariables);
    const cb = (f: Explorer) => {
      if (isFunctionDeclaration(f.tree!)) {
        return f.tree.name?.text === name;
      }

      if (isVariableStatement(f.tree!)) {
        const declaration = f.tree.declarationList.declarations[0];
        return (declaration.name as Identifier).text === name;
      }
    };

    return functions.find(cb) ?? new Explorer();
  }

  // Checks if a function with the given name exists in the current tree
  hasFunction(name: string, withVariables: boolean = false): boolean {
    return !this.findFunction(name, withVariables).isEmpty();
  }

  // Checks if a function (function declaration, method, arrow function, or function expression) has a specific return type annotation
  hasReturnAnnotation(annotation: string): boolean {
    if (!this.tree) {
      return false;
    }

    let functionNode:
      | FunctionDeclaration
      | MethodDeclaration
      | ArrowFunction
      | FunctionExpression
      | null = null;

    // Handle FunctionDeclaration, MethodDeclaration, ArrowFunction and FunctionExpression directly
    if (
      isFunctionDeclaration(this.tree) ||
      isMethodDeclaration(this.tree) ||
      isArrowFunction(this.tree) ||
      isFunctionExpression(this.tree)
    ) {
      functionNode = this.tree;
    }

    // Handle VariableStatement with function initializer
    if (isVariableStatement(this.tree)) {
      const { initializer } = this.tree.declarationList.declarations[0];
      if (
        initializer &&
        (isArrowFunction(initializer) || isFunctionExpression(initializer))
      ) {
        functionNode = initializer;
      }
    }

    // Check return type if we found a function node
    if (functionNode?.type) {
      const returnAnnotation = new Explorer(functionNode.type);
      const explorerAnnotation = new Explorer(
        annotation,
        SyntaxKind.TypeReference,
      );
      return returnAnnotation.matches(explorerAnnotation);
    }

    return false;
  }

  // Retrieves the parameters of a function, whether it's a function declaration or a variable statement initialized with a function
  getParameters(): Explorer[] {
    if (!this.tree) {
      return [];
    }

    if (isFunctionDeclaration(this.tree)) {
      return this.tree.parameters.map((param) => new Explorer(param));
    }

    if (isVariableStatement(this.tree)) {
      const { initializer } = this.tree.declarationList.declarations[0];
      if (
        (initializer && isArrowFunction(initializer)) ||
        (initializer && isFunctionExpression(initializer))
      ) {
        return initializer.parameters.map((param) => new Explorer(param));
      }
    }

    return [];
  }

  // Finds all type alias declarations in the current tree
  getTypes(): Explorer[] {
    return this.getAll(SyntaxKind.TypeAliasDeclaration);
  }

  // Finds a type alias declaration by name
  findType(name: string): Explorer {
    const types = this.getTypes();
    const cb = (t: Explorer) =>
      (t.tree as TypeAliasDeclaration).name.text === name;
    return types.find(cb) ?? new Explorer();
  }

  // Checks if a type alias declaration with the given name exists in the current tree
  hasType(name: string): boolean {
    return !this.findType(name).isEmpty();
  }

  // Finds all interface declarations in the current tree
  getInterfaces(): Explorer[] {
    return this.getAll(SyntaxKind.InterfaceDeclaration);
  }

  // Finds an interface declaration by name
  findInterface(name: string): Explorer {
    const interfaces = this.getInterfaces();
    const cb = (i: Explorer) =>
      (i.tree as InterfaceDeclaration).name.text === name;
    return interfaces.find(cb) ?? new Explorer();
  }

  // Checks if an interface declaration with the given name exists in the current tree
  hasInterface(name: string): boolean {
    return !this.findInterface(name).isEmpty();
  }

  // Finds all class declarations in the current tree
  getClasses(): Explorer[] {
    return this.getAll(SyntaxKind.ClassDeclaration);
  }

  // Finds a class declaration by name
  findClass(name: string): Explorer {
    const classes = this.getClasses();
    const cb = (c: Explorer) =>
      (c.tree as ClassDeclaration).name?.text === name;
    return classes.find(cb) ?? new Explorer();
  }

  // Checks if a class declaration with the given name exists in the current tree
  hasClass(name: string): boolean {
    return !this.findClass(name).isEmpty();
  }

  // Finds all method declarations within a class
  findMethods(): Explorer[] {
    if (this.tree && isClassDeclaration(this.tree)) {
      return this.tree.members
        .filter((member) => isMethodDeclaration(member))
        .map((method) => new Explorer(method));
    }

    return [];
  }

  // Finds a method declaration by name within a class
  findMethod(name: string): Explorer {
    const methods = this.findMethods();
    const cb = (m: Explorer) =>
      ((m.tree as MethodDeclaration).name as Identifier).text === name;
    return methods.find(cb) ?? new Explorer();
  }

  // Checks if a method declaration with the given name exists in the current tree
  hasMethod(name: string): boolean {
    return !this.findMethod(name).isEmpty();
  }

  // Finds all properties in a class
  findClassProps(): Explorer[] {
    if (!this.tree || !isClassDeclaration(this.tree)) {
      return [];
    }

    const properties: Explorer[] = [];

    this.tree.members.forEach((member) => {
      if (isPropertyDeclaration(member)) {
        properties.push(new Explorer(member));
      }
    });

    return properties;
  }

  // Finds a specific property in a class by name
  findClassProp(name: string): Explorer {
    const properties = this.findClassProps();
    const cb = (p: Explorer) =>
      ((p.tree as PropertyDeclaration).name as Identifier).text === name;
    return properties.find(cb) ?? new Explorer();
  }

  // Checks if a class has a property with the given name
  hasClassProp(name: string): boolean {
    return !this.findClassProp(name).isEmpty();
  }

  // Checks if a property with the given name (and optionally type and optionality) exists in the current tree, which can be an interface, type literal, or variable statement with a type literal annotation
  hasTypeProp(name: string, type?: string, isOptional?: boolean): boolean {
    if (!this.tree) {
      return false;
    }

    function findMembers(tree: Node): NodeArray<TypeElement> | undefined {
      // Handle VariableStatement with TypeLiteral annotation
      if (isVariableStatement(tree)) {
        const declaration = tree.declarationList.declarations[0];
        return declaration.type && isTypeLiteralNode(declaration.type)
          ? declaration.type.members
          : undefined;
      }

      // Handle InterfaceDeclaration
      if (isInterfaceDeclaration(tree)) {
        return tree.members;
      }

      // Handle TypeAliasDeclaration with TypeLiteral
      if (isTypeAliasDeclaration(tree)) {
        return isTypeLiteralNode(tree.type) ? tree.type.members : undefined;
      }

      // Handle TypeLiteral directly
      if (isTypeLiteralNode(tree)) {
        return tree.members;
      }

      // Handle Parameter (for destructured parameters)
      if (isParameter(tree)) {
        return tree.type && isTypeLiteralNode(tree.type)
          ? tree.type.members
          : undefined;
      }
    }

    const members = findMembers(this.tree);

    if (!members) {
      return false;
    }

    const member = Array.from(members).find((m) => {
      if (m.name && isIdentifier(m.name)) {
        return m.name.text === name;
      }

      return false;
    });

    if (!member) {
      return false;
    }

    // Check type if specified
    if (type !== undefined) {
      if (isPropertySignature(member)) {
        if (!member.type) {
          return false;
        }

        const memberType = new Explorer(member.type);
        if (!memberType.matches(new Explorer(type, SyntaxKind.TypeReference))) {
          return false;
        }
      } else {
        return false;
      }
    }

    // Check optionality if specified
    if (isOptional !== undefined) {
      if (isPropertySignature(member)) {
        const memberIsOptional = member.questionToken !== undefined;
        if (memberIsOptional !== isOptional) {
          return false;
        }
      }
    }

    return true;
  }

  // Checks if all specified properties exist in the current tree, which can be an interface, type literal, or variable statement with a type literal annotation
  hasTypeProps(
    props: { name: string; type?: string; isOptional?: boolean }[],
  ): boolean {
    return props.every((prop) =>
      this.hasTypeProp(prop.name, prop.type, prop.isOptional),
    );
  }
}

export { Explorer };
