import { Explorer } from "../helpers/lib/class/explorer";

expect.extend({
  toMatchExplorer(received: Explorer, expected: string) {
    const pass = received.matches(expected);
    return {
      message: () =>
        pass
          ? `Expected ${received.toString()} not to match ${expected}`
          : `Expected ${received.toString()} to match ${expected}`,
      pass,
    };
  },
});

describe("isEmpty", () => {
  it("returns true for an empty Explorer", () => {
    const explorer = new Explorer();
    expect(explorer.isEmpty()).toBe(true);
  });

  it("returns false for a non-empty Explorer", () => {
    const explorer = new Explorer("const a = 1;");
    expect(explorer.isEmpty()).toBe(false);
  });
});

describe("toString", () => {
  it("returns 'no ast' for an empty Explorer", () => {
    const explorer = new Explorer();
    expect(explorer.toString()).toBe("no ast");
  });

  it("returns the source code for a non-empty Explorer", () => {
    const sourceCode1 = "const a = 1;";
    const explorer = new Explorer(sourceCode1);
    expect(explorer.toString()).toBe(sourceCode1);

    const sourceCode2 = "function foo() { return 42; }";
    const explorer2 = new Explorer(sourceCode2);
    expect(explorer2.toString()).toBe(sourceCode2);
  });
});

describe("matches", () => {
  it("returns true when comparing equivalent nodes", () => {
    const explorer1 = new Explorer("const a = 1;");
    expect(explorer1.matches("const a = 1;")).toBe(true);

    const explorer2 = new Explorer("function foo() { return 42; }");
    expect(explorer2.matches("function foo() { return 42; }")).toBe(true);

    const explorer3 = new Explorer("interface Bar { x: number; }");
    expect(explorer3.matches("interface Bar { x: number; }")).toBe(true);

    const explorer4 = new Explorer();
    expect(explorer4.matches("")).toBe(true);
  });

  it("returns false when comparing non-equivalent nodes", () => {
    const explorer1 = new Explorer("const a = 1;");
    expect(explorer1.matches("const b = 2;")).toBe(false);

    const explorer2 = new Explorer("function foo() { return 42; }");
    expect(explorer2.matches("function bar() { return 42; }")).toBe(false);

    const explorer3 = new Explorer("interface Bar { x: number; }");
    expect(explorer3.matches("interface Baz { x: number; }")).toBe(false);
  });

  it("ignores irrelevant whitespace", () => {
    const explorer1 = new Explorer("const a = 1;");
    expect(explorer1.matches("const a =  1;")).toBe(true);
    expect(explorer1.matches("const  a = 1; ")).toBe(true);
    expect(explorer1.matches(" const a = 1;")).toBe(true);
    expect(explorer1.matches(" const a=1; ")).toBe(true);

    const explorer2 = new Explorer("function foo() { return 42; }");
    expect(explorer2.matches("function foo( ) { return 42; }")).toBe(true);
    expect(explorer2.matches("function foo () { return 42; } ")).toBe(true);
    expect(explorer2.matches(" function foo() { return 42; }")).toBe(true);
    expect(explorer2.matches(" function foo() { return 42; } ")).toBe(true);

    const explorer3 = new Explorer("interface Bar { x: number; }");
    expect(explorer3.matches("interface Bar { x:number; }")).toBe(true);
    expect(explorer3.matches("interface Bar { x:  number; } ")).toBe(true);
    expect(explorer3.matches(" interface Bar  { x: number; }")).toBe(true);
    expect(explorer3.matches(" interface Bar { x: number; } ")).toBe(true);
  });

  it("ignores trailing semicolons", () => {
    const explorer1 = new Explorer("const a = 1;");
    expect(explorer1.matches("const a = 1")).toBe(true);

    const explorer2 = new Explorer("function foo() { return 42; }");
    expect(explorer2.matches("function foo() { return 42 }")).toBe(true);

    const explorer3 = new Explorer("interface Bar { x: number; }");
    expect(explorer3.matches("interface Bar { x: number }")).toBe(true);
  });
});

describe("variables", () => {
  describe("getVariables", () => {
    it("returns an array of Explorer objects", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const variables = explorer.getVariables();
      variables.forEach((v) => expect(v).toBeInstanceOf(Explorer));
    });

    it("returns one entry per variable", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const variables = explorer.getVariables();
      expect(variables).toHaveLength(2);
    });

    it("returns an empty array if there are no variables", () => {
      const sourceCode = "function foo() { return 42; }";
      const explorer = new Explorer(sourceCode);
      const variables = explorer.getVariables();
      expect(variables).toHaveLength(0);
    });

    it("finds all variables in the current scope", () => {
      const sourceCode = `
                    const a = 1;
                    const bar = () => 42;
                    let baz;
                    function foo() { const b = 2; };
                `;
      const explorer = new Explorer(sourceCode);
      const variables = explorer.getVariables();
      expect(variables).toHaveLength(3);
      expect(variables[0].matches("const a = 1;")).toBe(true);
      expect(variables[1].matches("const bar = () => 42;")).toBe(true);
      expect(variables[2].matches("let baz;")).toBe(true);
    });
  });

  describe("findVariable", () => {
    it("returns an Explorer object for the specified variable name", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const variableA = explorer.findVariable("a");
      expect(variableA).toBeInstanceOf(Explorer);
      expect(variableA.matches("const a = 1;")).toBe(true);

      const variableB = explorer.findVariable("b");
      expect(variableB).toBeInstanceOf(Explorer);
      expect(variableB.matches("const b = 2;")).toBe(true);
    });

    it("returns an empty Explorer object if the specified variable name is not found", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const variableC = explorer.findVariable("c");
      expect(variableC).toBeInstanceOf(Explorer);
      expect(variableC.isEmpty()).toBe(true);
    });
  });

  describe("hasVariable", () => {
    it("returns true if a variable with the specified name exists", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasVariable("a")).toBe(true);
      expect(explorer.hasVariable("b")).toBe(true);
    });

    it("returns false if a variable with the specified name does not exist", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasVariable("c")).toBe(false);
    });
  });
});

describe("functions", () => {
  describe("findFunctions", () => {
    it("returns an array of Explorer objects", () => {
      const sourceCode =
        "function foo() { return 42; } function bar() { return 24; }";
      const explorer = new Explorer(sourceCode);
      const functions = explorer.getFunctions();
      functions.forEach((f) => expect(f).toBeInstanceOf(Explorer));
    });

    it("returns one entry per function", () => {
      const sourceCode =
        "function foo() { return 42; } function bar() { return 24; }";
      const explorer = new Explorer(sourceCode);
      const functions = explorer.getFunctions();
      expect(functions).toHaveLength(2);
    });

    it("returns an empty array if there are no functions", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const functions = explorer.getFunctions();
      expect(functions).toHaveLength(0);
    });

    it("finds only functions in the current scope", () => {
      const sourceCode = `
                    function foo() { return 42; }
                    function bar() { function baz() { return 24; } }
                `;
      const explorer = new Explorer(sourceCode);
      const functions = explorer.getFunctions();
      expect(functions).toHaveLength(2);
      expect(functions[0].matches("function foo() { return 42; }")).toBe(true);
      expect(
        functions[1].matches(
          "function bar() { function baz() { return 24; } }",
        ),
      ).toBe(true);
    });

    it("does not find function expressions and arrow functions assigned to variables by default", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      const functions = explorer.getFunctions();
      expect(functions).toHaveLength(0);
    });

    it("finds function expressions and arrow functions assigned to variables when withVariables is true", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      const functions = explorer.getFunctions(true);
      expect(functions).toHaveLength(2);
    });
  });

  describe("findFunction", () => {
    it("returns an Explorer object for the specified function name", () => {
      const sourceCode = `
                    const a = [1, 2, 3];
                    function foo() { return 42; }
                    const b = 1;
                `;
      const explorer = new Explorer(sourceCode);
      const functionFoo = explorer.findFunction("foo");
      expect(functionFoo).toBeInstanceOf(Explorer);
      expect(functionFoo.matches("function foo() { return 42; }")).toBe(true);
    });

    it("returns an empty Explorer object if the specified function name is not found", () => {
      const sourceCode = `
                    function foo() { return 42; }
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      const functionBaz = explorer.findFunction("baz");
      expect(functionBaz).toBeInstanceOf(Explorer);
      expect(functionBaz.isEmpty()).toBe(true);
    });

    it("does not find function expressions and arrow functions assigned to variables by default", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      const functionFoo = explorer.findFunction("foo");
      expect(functionFoo.isEmpty()).toBe(true);

      const functionBar = explorer.findFunction("bar");
      expect(functionBar.isEmpty()).toBe(true);
    });

    it("finds function expressions and arrow functions assigned to variables when withVariables is true", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      const functionFoo = explorer.findFunction("foo", true);
      expect(functionFoo).toBeInstanceOf(Explorer);
      expect(
        functionFoo.matches("const foo = function() { return 42; };"),
      ).toBe(true);

      const functionBar = explorer.findFunction("bar", true);
      expect(functionBar).toBeInstanceOf(Explorer);
      expect(functionBar.matches("const bar = () => 24;")).toBe(true);
    });
  });

  describe("hasFunction", () => {
    it("returns true if a function with the specified name exists", () => {
      const sourceCode = `
                    function foo() { return 42; }
                    const bar = () => 24;
                    const baz = function() { return 42; };
                `;
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasFunction("foo")).toBe(true);
    });

    it("returns false if a function with the specified name does not exist", () => {
      const sourceCode = `
                    function foo() { return 42; }
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasFunction("baz")).toBe(false);
    });

    it("does not find function expressions and arrow functions assigned to variables by default", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasFunction("foo")).toBe(false);
      expect(explorer.hasFunction("bar")).toBe(false);
    });

    it("finds function expressions and arrow functions assigned to variables when withVariables is true", () => {
      const sourceCode = `
                    const foo = function() { return 42; };
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasFunction("foo", true)).toBe(true);
      expect(explorer.hasFunction("bar", true)).toBe(true);
    });
  });

  describe("getParameters", () => {
    it("returns an array of Explorer objects for the parameters of a function", () => {
      const sourceCode = `
                    function foo(x: number, y: string) { return 42; }
                    const bar = (a: boolean) => 24;
                    const baz = function(b: any, c: string) { return 42; };
                `;
      const explorer = new Explorer(sourceCode);
      const functionFoo = explorer.findFunction("foo");
      const parametersFoo = functionFoo.getParameters();
      expect(parametersFoo).toHaveLength(2);
      // TODO: handles comparison of parameters in matches().
      // This doesn't ignore whitespace
      expect(parametersFoo[0].toString()).toBe("x: number");
      expect(parametersFoo[1].toString()).toBe("y: string");

      const functionBar = explorer.findFunction("bar", true);
      const parametersBar = functionBar.getParameters();
      expect(parametersBar).toHaveLength(1);
      expect(parametersBar[0].toString()).toBe("a: boolean");

      const functionBaz = explorer.findFunction("baz", true);
      const parametersBaz = functionBaz.getParameters();
      expect(parametersBaz).toHaveLength(2);
      expect(parametersBaz[0].toString()).toBe("b: any");
      expect(parametersBaz[1].toString()).toBe("c: string");
    });

    it("returns an empty array if the function has no parameters", () => {
      const sourceCode = `
                    function foo() { return 42; }
                    const bar = () => 24;
                `;
      const explorer = new Explorer(sourceCode);
      const functionFoo = explorer.findFunction("foo");
      const parametersFoo = functionFoo.getParameters();
      expect(parametersFoo).toHaveLength(0);

      const functionBar = explorer.findFunction("bar", true);
      const parametersBar = functionBar.getParameters();
      expect(parametersBar).toHaveLength(0);
    });
  });

  describe("hasReturnAnnotation", () => {
    it("returns true if the function has the specified return type annotation", () => {
      const sourceCode = `
                    function foo(): number { return 42; }
                    const bar = (): string => "hello";
                    const baz = function(): boolean { return true; };
                `;
      const explorer = new Explorer(sourceCode);
      const functionFoo = explorer.findFunction("foo");
      expect(functionFoo.hasReturnAnnotation("number")).toBe(true);

      const functionBar = explorer.findFunction("bar", true);
      expect(functionBar.hasReturnAnnotation("string")).toBe(true);

      const functionBaz = explorer.findFunction("baz", true);
      expect(functionBaz.hasReturnAnnotation("boolean")).toBe(true);
    });

    it("returns false if the function does not have the specified return type annotation", () => {
      const sourceCode = `
                    function foo(): number { return 42; }
                    const bar = (): string => "hello";
                `;
      const explorer = new Explorer(sourceCode);
      const functionFoo = explorer.findFunction("foo");
      expect(functionFoo.hasReturnAnnotation("string")).toBe(false);

      const functionBar = explorer.findFunction("bar", true);
      expect(functionBar.hasReturnAnnotation("number")).toBe(false);
    });

    it("returns false if the function has no return type annotation", () => {
      const sourceCode = `
                    function foo() { return 42; }
                    const bar = () => "hello";
                `;
      const explorer = new Explorer(sourceCode);
      const functionFoo = explorer.findFunction("foo");
      expect(functionFoo.hasReturnAnnotation("number")).toBe(false);

      const functionBar = explorer.findFunction("bar", true);
      expect(functionBar.hasReturnAnnotation("string")).toBe(false);
    });
  });
});

describe("types", () => {
  describe("findTypes", () => {
    it("returns an array of Explorer objects", () => {
      const sourceCode =
        "type Foo = { x: number; }; type Bar = { y: string; };";
      const explorer = new Explorer(sourceCode);
      const types = explorer.getTypes();
      types.forEach((t) => expect(t).toBeInstanceOf(Explorer));
    });

    it("returns one entry per type", () => {
      const sourceCode =
        "type Foo = { x: number; }; type Bar = { y: string; };";
      const explorer = new Explorer(sourceCode);
      const types = explorer.getTypes();
      expect(types).toHaveLength(2);
    });

    it("returns an empty array if there are no types", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const types = explorer.getTypes();
      expect(types).toHaveLength(0);
    });

    it("finds only types in the current scope", () => {
      const sourceCode = `
                    type Foo = { x: number; };
                    function bar() { type Baz = { y: string; }; }
                `;
      const explorer = new Explorer(sourceCode);
      const types = explorer.getTypes();
      expect(types).toHaveLength(1);
      expect(types[0].matches("type Foo = { x: number; };")).toBe(true);
    });
  });

  describe("findType", () => {
    it("returns an Explorer object for the specified type name", () => {
      const sourceCode =
        "type Foo = { x: number; }; type Bar = { y: string; };";
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(typeFoo).toBeInstanceOf(Explorer);
      expect(typeFoo.matches("type Foo = { x: number; };")).toBe(true);

      const typeBar = explorer.findType("Bar");
      expect(typeBar).toBeInstanceOf(Explorer);
      expect(typeBar.matches("type Bar = { y: string; };")).toBe(true);
    });

    it("returns an empty Explorer object if the specified type name is not found", () => {
      const sourceCode =
        "type Foo = { x: number; }; type Bar = { y: string; };";
      const explorer = new Explorer(sourceCode);
      const typeBaz = explorer.findType("Baz");
      expect(typeBaz).toBeInstanceOf(Explorer);
      expect(typeBaz.isEmpty()).toBe(true);
    });
  });

  describe("hasType", () => {
    it("returns true if a type with the specified name exists", () => {
      const sourceCode =
        "type Foo = { x: number; }; type Bar = { y: string; };";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasType("Foo")).toBe(true);
      expect(explorer.hasType("Bar")).toBe(true);
    });

    it("returns false if a type with the specified name does not exist", () => {
      const sourceCode =
        "type Foo = { x: number; }; type Bar = { y: string; };";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasType("Baz")).toBe(false);
    });
  });
});

describe("interfaces", () => {
  describe("findInterfaces", () => {
    it("returns an array of Explorer objects", () => {
      const sourceCode =
        "interface Foo { x: number; } interface Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      const interfaces = explorer.getInterfaces();
      interfaces.forEach((i) => expect(i).toBeInstanceOf(Explorer));
    });

    it("returns one entry per interface", () => {
      const sourceCode =
        "interface Foo { x: number; } interface Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      const interfaces = explorer.getInterfaces();
      expect(interfaces).toHaveLength(2);
    });

    it("returns an empty array if there are no interfaces", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const interfaces = explorer.getInterfaces();
      expect(interfaces).toHaveLength(0);
    });

    it("finds only interfaces in the current scope", () => {
      const sourceCode = `
                    interface Foo { x: number; }
                    function bar() { interface Baz { y: string; } }
                `;
      const explorer = new Explorer(sourceCode);
      const interfaces = explorer.getInterfaces();
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].matches("interface Foo { x: number; }")).toBe(true);
    });
  });

  describe("findInterface", () => {
    it("returns an Explorer object for the specified interface name", () => {
      const sourceCode =
        "interface Foo { x: number; } interface Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      const interfaceFoo = explorer.findInterface("Foo");
      expect(interfaceFoo).toBeInstanceOf(Explorer);
      expect(interfaceFoo.matches("interface Foo { x: number; }")).toBe(true);

      const interfaceBar = explorer.findInterface("Bar");
      expect(interfaceBar).toBeInstanceOf(Explorer);
      expect(interfaceBar.matches("interface Bar { y: string; }")).toBe(true);
    });

    it("returns an empty Explorer object if the specified interface name is not found", () => {
      const sourceCode =
        "interface Foo { x: number; } interface Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      const interfaceBaz = explorer.findInterface("Baz");
      expect(interfaceBaz).toBeInstanceOf(Explorer);
      expect(interfaceBaz.isEmpty()).toBe(true);
    });
  });

  describe("hasInterface", () => {
    it("returns true if an interface with the specified name exists", () => {
      const sourceCode =
        "interface Foo { x: number; } interface Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasInterface("Foo")).toBe(true);
      expect(explorer.hasInterface("Bar")).toBe(true);
    });

    it("returns false if an interface with the specified name does not exist", () => {
      const sourceCode =
        "interface Foo { x: number; } interface Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasInterface("Baz")).toBe(false);
    });
  });
});

describe("classes", () => {
  describe("findClasses", () => {
    it("returns an array of Explorer objects", () => {
      const sourceCode = "class Foo { x: number; } class Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      const classes = explorer.getClasses();
      classes.forEach((c) => expect(c).toBeInstanceOf(Explorer));
    });

    it("returns one entry per class", () => {
      const sourceCode = "class Foo { x: number; } class Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      const classes = explorer.getClasses();
      expect(classes).toHaveLength(2);
    });

    it("returns an empty array if there are no classes", () => {
      const sourceCode = "const a = 1; const b = 2;";
      const explorer = new Explorer(sourceCode);
      const classes = explorer.getClasses();
      expect(classes).toHaveLength(0);
    });

    it("finds only classes in the current scope", () => {
      const sourceCode = `
                    class Foo { x: number; }
                    function bar() { class Baz { y: string; } }
                `;
      const explorer = new Explorer(sourceCode);
      const classes = explorer.getClasses();
      expect(classes).toHaveLength(1);
      expect(classes[0].matches("class Foo { x: number; }")).toBe(true);
    });
  });

  describe("findClass", () => {
    it("returns an Explorer object for the specified class name", () => {
      const sourceCode = "class Foo { x: number; } class Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      const classFoo = explorer.findClass("Foo");
      expect(classFoo).toBeInstanceOf(Explorer);
      expect(classFoo.matches("class Foo { x: number; }")).toBe(true);

      const classBar = explorer.findClass("Bar");
      expect(classBar).toBeInstanceOf(Explorer);
      expect(classBar.matches("class Bar { y: string; }")).toBe(true);
    });

    it("returns an empty Explorer object if the specified class name is not found", () => {
      const sourceCode = "class Foo { x: number; } class Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      const classBaz = explorer.findClass("Baz");
      expect(classBaz).toBeInstanceOf(Explorer);
      expect(classBaz.isEmpty()).toBe(true);
    });
  });

  describe("hasClass", () => {
    it("returns true if a class with the specified name exists", () => {
      const sourceCode = "class Foo { x: number; } class Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasClass("Foo")).toBe(true);
      expect(explorer.hasClass("Bar")).toBe(true);
    });

    it("returns false if a class with the specified name does not exist", () => {
      const sourceCode = "class Foo { x: number; } class Bar { y: string; }";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasClass("Baz")).toBe(false);
    });
  });
});

describe("methods", () => {
  describe("findMethods", () => {
    it("returns an array of Explorer objects", () => {
      const sourceCode = "class Foo { method1() {} method2() {} }";
      const explorer = new Explorer(sourceCode);
      const methods = explorer.findMethods();
      methods.forEach((m) => expect(m).toBeInstanceOf(Explorer));
    });

    it("returns one entry per method", () => {
      const sourceCode = "class Foo { method1() {} method2() {} }";
      const explorer = new Explorer(sourceCode);
      const methods = explorer.findMethods();
      expect(methods).toHaveLength(2);
    });

    it("returns an empty array if there are no methods", () => {
      const sourceCode = "class Foo { }";
      const explorer = new Explorer(sourceCode);
      const methods = explorer.findMethods();
      expect(methods).toHaveLength(0);
    });

    it("does not find methods unless called on a class Explorer", () => {
      const sourceCode = `
const x = 1;
class Foo { method1() {} }
`;

      const explorer = new Explorer(sourceCode);
      const methods = explorer.findMethods();
      expect(methods).toHaveLength(0);

      const classExplorer = explorer.findClass("Foo");
      const methodsInClass = classExplorer.findMethods();
      expect(methodsInClass).toHaveLength(1);
    });

    it("only finds methods when called on a single class Explorer", () => {
      const sourceCode = `
class Foo { method1() {} }
class Bar { method2() {} }
`;
      const explorer = new Explorer(sourceCode);
      const methods = explorer.findMethods();
      expect(methods).toHaveLength(0);
    });
  });

  describe("findMethod", () => {
    it("returns an Explorer object for the specified method name", () => {
      const sourceCode = "class Foo { method1() {} method2() {} }";
      const explorer = new Explorer(sourceCode);
      const method1 = explorer.findMethod("method1");
      expect(method1).toBeInstanceOf(Explorer);
      expect(method1.matches("method1() {}")).toBe(true);

      const method2 = explorer.findMethod("method2");
      expect(method2).toBeInstanceOf(Explorer);
      expect(method2.matches("method2() {}")).toBe(true);
    });

    it("returns an empty Explorer object if the specified method name is not found", () => {
      const sourceCode = "class Foo { method1() {} method2() {} }";
      const explorer = new Explorer(sourceCode);
      const method3 = explorer.findMethod("method3");
      expect(method3).toBeInstanceOf(Explorer);
      expect(method3.isEmpty()).toBe(true);
    });
  });

  describe("hasMethod", () => {
    it("returns true if a method with the specified name exists", () => {
      const sourceCode = "class Foo { method1() {} method2() {} }";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasMethod("method1")).toBe(true);
      expect(explorer.hasMethod("method2")).toBe(true);
    });

    it("returns false if a method with the specified name does not exist", () => {
      const sourceCode = "class Foo { method1() {} method2() {} }";
      const explorer = new Explorer(sourceCode);
      expect(explorer.hasMethod("method3")).toBe(false);
    });
  });

  describe("findClassProps", () => {
    it("returns an array of Explorer objects", () => {
      const sourceCode = `
                    class Rectangle {
                      constructor(height, width) {
                        this.height = height;
                        this.width = width;
                      }
                    }
                    class Foo { prop1: number; prop2: string; }
                `;
      const explorer = new Explorer(sourceCode);
      const rectangleClass = explorer.findClass("Rectangle");
      const rectangleProps = rectangleClass.findClassProps();
      rectangleProps.forEach((p) => expect(p).toBeInstanceOf(Explorer));

      const fooClass = explorer.findClass("Foo");
      const props = fooClass.findClassProps();
      props.forEach((p) => expect(p).toBeInstanceOf(Explorer));
    });

    it("returns one entry per property", () => {
      const sourceCode = `
                    class Rectangle {
                      constructor(height, width) {
                        this.height = height;
                        this.width = width;
                      }
                    }
                    class Foo { prop1: number; prop2: string; }
                `;
      const explorer = new Explorer(sourceCode);
      const rectangleClass = explorer.findClass("Rectangle");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const rectangleProps = rectangleClass.findClassProps();
      // TODO: fix method to handleexpect(rectangleProps).toHaveLength(2);

      const fooClass = explorer.findClass("Foo");
      const props = fooClass.findClassProps();
      expect(props).toHaveLength(2);
    });

    it("returns an empty array if there are no properties", () => {
      const sourceCode = "class Foo { }";
      const explorer = new Explorer(sourceCode);
      const fooClass = explorer.findClass("Foo");
      const props = fooClass.findClassProps();
      expect(props).toHaveLength(0);
    });

    it("finds only properties in the current class", () => {
      const sourceCode = `
                      class Foo { prop1: number; }
                      class Bar { prop2: string; }
                  `;
      const explorer = new Explorer(sourceCode);
      const fooClass = explorer.findClass("Foo");
      const props = fooClass.findClassProps();
      expect(props).toHaveLength(1);
      // TODO: fix matches to handle expect(props[0].matches("prop1: number;")).toBe(true);
    });
  });

  // TODO: describe("findClassProp", () => { });

  // TODO:describe("hasClassProp", () => { });
});

describe("annotations", () => {
  describe("getAnnotation", () => {
    it("returns an Explorer object if the annotation exists", () => {
      const sourceCode = `
                    const a: number = 1;
                    function foo(x: number, y: string): void { }
                    interface Bar { x: number; }
                    class Baz { spam: "spam" = "spam"; }
                `;
      const explorer = new Explorer(sourceCode);
      const varAnnotation = explorer.findVariable("a").getAnnotation();
      expect(varAnnotation).toBeInstanceOf(Explorer);
      // TODO: handles comparison of annotations in matches(). This doesn't ignore whitespace
      expect(varAnnotation.toString()).toBe("number");
    });
  });

  describe("hasAnnotation", () => {
    it("returns true if the specified annotation exists", () => {
      const sourceCode = `
                    const a: number = 1;
                    function foo(x: number, y: string): void { }
                    interface Bar { x: number; }
                    class Baz { spam: "spam" = "spam"; }
                `;
      const explorer = new Explorer(sourceCode);
      expect(explorer.findVariable("a").hasAnnotation("number")).toBe(true);

      const parametersFoo = explorer.findFunction("foo").getParameters();
      expect(parametersFoo[0].hasAnnotation("number")).toBe(true);
      expect(parametersFoo[1].hasAnnotation("string")).toBe(true);

      // TODO: complete findTypeProp
    });

    it("returns false if the annotation is different from the argument", () => {
      const sourceCode = `
                    const a: number = 1;
                    function foo(x: number, y: string): void { }
                    interface Bar { x: number; }
                    class Baz { spam: "spam" = "spam"; }
                `;
      const explorer = new Explorer(sourceCode);
      expect(explorer.findVariable("a").hasAnnotation("string")).toBe(false);

      const parametersFoo = explorer.findFunction("foo").getParameters();
      expect(parametersFoo[0].hasAnnotation("string")).toBe(false);
      expect(parametersFoo[1].hasAnnotation("number")).toBe(false);
    });

    it("returns false if the value is not annotated", () => {
      const sourceCode = `
                    const a = 1;
                    function foo(x, y) { }
                `;
      const explorer = new Explorer(sourceCode);
      expect(explorer.findVariable("a").hasAnnotation("number")).toBe(false);

      const parametersFoo = explorer.findFunction("foo").getParameters();
      expect(parametersFoo[0].hasAnnotation("number")).toBe(false);
      expect(parametersFoo[1].hasAnnotation("string")).toBe(false);
    });
  });
});

describe("type props", () => {
  describe("hasTypeProp", () => {
    it("returns true if the specified type prop exists", () => {
      const sourceCode = `
                    type Foo = { x: number; y: string; };
                    interface Bar { x: number; y: string; }
                    let baz: { x: number; y: string; };
                `;
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(typeFoo.hasTypeProp("x")).toBe(true);
      expect(typeFoo.hasTypeProp("y")).toBe(true);

      const interfaceBar = explorer.findInterface("Bar");
      expect(interfaceBar.hasTypeProp("x")).toBe(true);
      expect(interfaceBar.hasTypeProp("y")).toBe(true);

      const varBaz = explorer.findVariable("baz");
      expect(varBaz.hasTypeProp("x")).toBe(true);
      expect(varBaz.hasTypeProp("y")).toBe(true);
    });

    it("returns false if the specified type prop does not exist", () => {
      const sourceCode = `
                    type Foo = { x: number; y: string; };
                    interface Bar { x: number; y: string; }
                    let baz: { x: number; y: string; };
                `;
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(typeFoo.hasTypeProp("z")).toBe(false);

      const interfaceBar = explorer.findInterface("Bar");
      expect(interfaceBar.hasTypeProp("z")).toBe(false);

      const varBaz = explorer.findVariable("baz");
      expect(varBaz.hasTypeProp("z")).toBe(false);
    });

    it("returns false if there are no type props", () => {
      const sourceCode = `
                    type Foo = { };
                    interface Bar { }
                    let baz: { };
                `;
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(typeFoo.hasTypeProp("x")).toBe(false);

      const interfaceBar = explorer.findInterface("Bar");
      expect(interfaceBar.hasTypeProp("x")).toBe(false);

      const varBaz = explorer.findVariable("baz");
      expect(varBaz.hasTypeProp("x")).toBe(false);
    });

    it("returns true if the specified prop has the specified type annotation", () => {
      const sourceCode = `
                    type Foo = { x: number; y: string; };
                    interface Bar { x: number; y: string; }
                    let baz: { x: number; y: string; };
                `;
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(typeFoo.hasTypeProp("x", "number")).toBe(true);
      expect(typeFoo.hasTypeProp("y", "string")).toBe(true);

      const interfaceBar = explorer.findInterface("Bar");
      expect(interfaceBar.hasTypeProp("x", "number")).toBe(true);
      expect(interfaceBar.hasTypeProp("y", "string")).toBe(true);

      const varBaz = explorer.findVariable("baz");
      expect(varBaz.hasTypeProp("x", "number")).toBe(true);
      expect(varBaz.hasTypeProp("y", "string")).toBe(true);
    });

    it("returns false if the specified prop has a different type annotation", () => {
      const sourceCode = `
                    type Foo = { x: number; y: string; };
                    interface Bar { x: number; y: string; }
                    let baz: { x: number; y: string; };
                `;
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(typeFoo.hasTypeProp("x", "string")).toBe(false);
      expect(typeFoo.hasTypeProp("y", "number")).toBe(false);

      const interfaceBar = explorer.findInterface("Bar");
      expect(interfaceBar.hasTypeProp("x", "string")).toBe(false);
      expect(interfaceBar.hasTypeProp("y", "number")).toBe(false);

      const varBaz = explorer.findVariable("baz");
      expect(varBaz.hasTypeProp("x", "string")).toBe(false);
      expect(varBaz.hasTypeProp("y", "number")).toBe(false);
    });

    it("returns true if the specified prop has the specified type annotation and is optional when isOptional is true", () => {
      const sourceCode = `
                    type Foo = { x?: number; y?: string; };
                    interface Bar { x?: number; y?: string; }
                    let baz: { x?: number; y?: string; };
                `;
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(typeFoo.hasTypeProp("x", "number", true)).toBe(true);
      expect(typeFoo.hasTypeProp("y", "string", true)).toBe(true);

      const interfaceBar = explorer.findInterface("Bar");
      expect(interfaceBar.hasTypeProp("x", "number", true)).toBe(true);
      expect(interfaceBar.hasTypeProp("y", "string", true)).toBe(true);

      const varBaz = explorer.findVariable("baz");
      expect(varBaz.hasTypeProp("x", "number", true)).toBe(true);
      expect(varBaz.hasTypeProp("y", "string", true)).toBe(true);
    });

    it("returns false if the specified prop is optional but isOptional is false", () => {
      const sourceCode = `
                    type Foo = { x?: number; y?: string; };
                    interface Bar { x?: number; y?: string; }
                    let baz: { x?: number; y?: string; };
                `;
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(typeFoo.hasTypeProp("x", "number", false)).toBe(false);
      expect(typeFoo.hasTypeProp("y", "string", false)).toBe(false);

      const interfaceBar = explorer.findInterface("Bar");
      expect(interfaceBar.hasTypeProp("x", "number", false)).toBe(false);
      expect(interfaceBar.hasTypeProp("y", "string", false)).toBe(false);

      const varBaz = explorer.findVariable("baz");
      expect(varBaz.hasTypeProp("x", "number", false)).toBe(false);
      expect(varBaz.hasTypeProp("y", "string", false)).toBe(false);
    });

    it("ignores the type annotation when the type argument is undefined", () => {
      const sourceCode = `
                    type Foo = { x?: number; y: string; };
                    interface Bar { x: number; y?: string; }
                    let baz: { x?: number; y: string; };
                `;
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(typeFoo.hasTypeProp("x", undefined, true)).toBe(true);
      expect(typeFoo.hasTypeProp("y", undefined, true)).toBe(false);
      expect(typeFoo.hasTypeProp("y", undefined, false)).toBe(true);

      const interfaceBar = explorer.findInterface("Bar");
      expect(interfaceBar.hasTypeProp("x", undefined, false)).toBe(true);
      expect(interfaceBar.hasTypeProp("x", undefined, true)).toBe(false);
      expect(interfaceBar.hasTypeProp("y", undefined, true)).toBe(true);

      const varBaz = explorer.findVariable("baz");
      expect(varBaz.hasTypeProp("x", undefined, true)).toBe(true);
      expect(varBaz.hasTypeProp("y", undefined, false)).toBe(true);
      expect(varBaz.hasTypeProp("y", undefined, true)).toBe(false);
    });
  });

  describe("hasTypeProps", () => {
    it("returns true if the specified type props exist", () => {
      const sourceCode = `
                    type Foo = { x: number; y: string; z: boolean; };
                    interface Bar { x: number; y?: string; }
                    let baz: { x?: number; y: string; };
                `;
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(
        typeFoo.hasTypeProps([
          { name: "x", type: "number" },
          { name: "y", type: "string" },
        ]),
      ).toBe(true);

      const interfaceBar = explorer.findInterface("Bar");
      expect(
        interfaceBar.hasTypeProps([
          { name: "x", type: "number" },
          { name: "y", type: "string", isOptional: true },
        ]),
      ).toBe(true);

      const varBaz = explorer.findVariable("baz");
      expect(
        varBaz.hasTypeProps([{ name: "x", isOptional: true }, { name: "y" }]),
      ).toBe(true);
    });

    it("returns false if any of the specified type props do not exist", () => {
      const sourceCode = `
                    type Foo = { x: number; y: string; z: boolean; };
                    interface Bar { x: number; y?: string; }
                    let baz: { x?: number; y: string; };
                `;
      const explorer = new Explorer(sourceCode);
      const typeFoo = explorer.findType("Foo");
      expect(
        typeFoo.hasTypeProps([
          { name: "x", type: "number" },
          { name: "a", type: "string" },
        ]),
      ).toBe(false);

      const interfaceBar = explorer.findInterface("Bar");
      expect(
        interfaceBar.hasTypeProps([
          { name: "x", type: "number" },
          { name: "a", type: "string", isOptional: true },
        ]),
      ).toBe(false);

      const varBaz = explorer.findVariable("baz");
      expect(varBaz.hasTypeProps([{ name: "x", isOptional: false }])).toBe(
        false,
      );
    });
  });
});
