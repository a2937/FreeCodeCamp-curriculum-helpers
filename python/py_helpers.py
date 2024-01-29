import ast

# A chainable class that allows us to call functions on the result of parsing a string


class Node:
    # TODO: allow initialization with a string
    def __init__(self, tree=None):
        if isinstance(tree, str):
            self.tree = ast.parse(tree)
        elif isinstance(tree, ast.AST) or tree == None:
            self.tree = tree
        else:
            raise TypeError("Node must be initialized with a string or AST")

    def __getitem__(self, i):
        if getattr(self.tree, "__getitem__", False):
            return Node(self.tree[i])
        else:
            return Node(self.tree.body[i])

    def __len__(self):
        if getattr(self.tree, "__len__", False):
            return len(self.tree)
        else:
            return len(self.tree.body)

    def __eq__(self, other):
        if not isinstance(other, Node):
            return False
        if self.tree == None:
            return other.tree == None
        if other.tree == None:
            return False
        return ast.dump(self.tree, include_attributes=True) == ast.dump(
            other.tree, include_attributes=True
        )

    def __repr__(self):
        if self.tree == None:
            return "Node:\nNone"
        return "Node:\n" + ast.dump(self.tree, indent=2)

    def _has_body(self):
        return bool(getattr(self.tree, "body", False))

    # "find" functions return a new node with the result of the find
    # function. In this case, it returns a new node with the function
    # definition (if it exists)

    def find_function(self, func):
        if not self._has_body():
            return Node()
        for node in self.tree.body:
            if isinstance(node, ast.FunctionDef):
                if node.name == func:
                    return Node(node)
        return Node()

    # "has" functions return a boolean indicating whether whatever is being
    # searched for exists. In this case, it returns True if the variable exists.

    def has_variable(self, name):
        return self.find_variable(name) != Node()

    def find_variable(self, name):
        if not self._has_body():
            return Node()
        for node in self.tree.body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        if target.id == name:
                            return Node(node)
        return Node()

    def get_variable(self, name):
        var = self.find_variable(name)
        if var != Node():
            return var.tree.value.value
        else:
            return None

    def has_function(self, name):
        return self.find_function(name) != Node()

    # Checks the variable, name, is in the current scope and is an integer

    def is_integer(self):
        if not isinstance(self.tree, ast.Assign):
            return False
        return type(self.tree.value.value) == type(1)

    def value_is_call(self, name):
        if not isinstance(self.tree, ast.Assign):
            return False
        call = self.tree.value
        if isinstance(call, ast.Call):
            return call.func.id == name
        return False

    # Takes an string and checks if is equivalent to the node's AST. This
    # is a loose comparison that tries to find out if the code is essentially
    # the same. For example, the string "True" is not represented by the same
    # AST as the test in "if True:" (the string could be wrapped in Module,
    # Interactive or Expression, depending on the parse mode and the test is
    # just a Constant), but they are equivalent.

    def is_equivalent(self, target_str):
        # Setting the tree to None is used to represent missing elements. Such
        # as the condition of a final else clause. It is, therefore, not
        # equivalent to any string.
        if self.tree == None:
            return False
        return ast.unparse(self.tree) == ast.unparse(ast.parse(target_str))

    # Finds the class definition with the given name

    def find_class(self, class_name):
        if not self._has_body():
            return Node()
        for node in self.tree.body:
            if isinstance(node, ast.ClassDef):
                if node.name == class_name:
                    return Node(node)
        return Node()

    # Find an array of conditions in an if statement

    def find_ifs(self):
        return self._find_all(ast.If)

    def _find_all(self, ast_type):
        return [
            Node(node) for node in self.tree.body if isinstance(node, ast_type)
        ]

    def find_conditions(self):
        def _find_conditions(tree):
            if not isinstance(tree, ast.If):
                return []
            test = tree.test
            if self.tree.orelse == []:
                return [test]
            if isinstance(tree.orelse[0], ast.If):
                return [test] + _find_conditions(tree.orelse[0])

            return [test, None]

        return [Node(test) for test in _find_conditions(self.tree)]

    # Find an array of bodies in an elif statement

    def find_if_bodies(self):
        def _find_if_bodies(tree):
            if not isinstance(tree, ast.If):
                return []
            if self.tree.orelse == []:
                return [tree.body]
            if isinstance(tree.orelse[0], ast.If):
                return [tree.body] + _find_if_bodies(tree.orelse[0])

            return [tree.body] + [tree.orelse]

        return [
            Node(ast.Module(body, [])) for body in _find_if_bodies(self.tree)
        ]