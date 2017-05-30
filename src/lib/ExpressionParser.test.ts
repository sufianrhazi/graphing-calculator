import {
    parse,
    compileExpr,
    NodeCall,
    NodeExpr,
    NodeNumber,
    NodeOperatorBinary,
    NodeOperatorUnary,
    NodeReference,
    NodeBinding,
    NodeFunction,
    NodeIf,
} from './ExpressionParser';
import { assert } from 'chai';

function astNumber(val: number): NodeNumber {
    return { type: "number", value: val };
}
function astRef(val: string): NodeReference {
    return { type: "reference", value: val };
}
function astCall(ref: NodeReference, args: NodeExpr[]): NodeCall {
    return { type: "call", value: { reference: ref, args: args }};
}
function astUnary(op: string, fixity: "prefix" | "postfix", val: NodeExpr): NodeOperatorUnary {
    return { type: "unary", value: { op: op, fixity: fixity, value: val }};
}
function astBinary(op: string, left: NodeExpr, right: NodeExpr): NodeOperatorBinary {
    return { type: "binary", value: { op: op, left: left, right: right } };
}
function astIf(cond: NodeExpr, thenExpr: NodeExpr, elseExpr: NodeExpr): NodeIf {
    return { type: "if", value: { cond: cond, then: thenExpr, else: elseExpr } };
}
function astBinding(reference: string, binding: NodeExpr, value: NodeExpr): NodeBinding {
    return {
        type: "binding", 
        value: {
            reference: {
                type: "reference",
                value: reference,
            },
            binding: binding,
            expression: value
        }
    };
}
function astFunction(ref: string, args: NodeReference[], body: NodeExpr, context: NodeExpr): NodeFunction {
    return {
        type: "function",
        value: {
            reference: { type: "reference", value: ref },
            args: args,
            body: body,
            context: context,
        }
    }
}

function exprToString(expr: NodeExpr): string {
    switch (expr.type) {
        case 'binary':
            return `(${exprToString(expr.value.left)} ${expr.value.op} ${exprToString(expr.value.right)})`;
        case 'unary':
            return `(-${exprToString(expr.value.value)})`;
        case 'call':
            return `${exprToString(expr.value.reference)}(${expr.value.args.map(arg => exprToString(arg)).join(', ')})`;
        case 'reference':
            return expr.value;
        case 'number':
            return expr.value.toString();
        case 'binding':
            return `let ${exprToString(expr.value.reference)} = ${exprToString(expr.value.binding)} in ${exprToString(expr.value.expression)}`;
        case 'function':
            return `let ${exprToString(expr.value.reference)}(${expr.value.args.map(arg => exprToString(arg)).join(', ')}) = ${exprToString(expr.value.body)} in ${exprToString(expr.value.context)}`
        case 'if':
            return `if ${exprToString(expr.value.cond)} then ${exprToString(expr.value.then)} else ${exprToString(expr.value.else)}`;
    }
}

function assertExpr(expected: NodeExpr, result: NodeExpr): void {
    assert.equal(exprToString(expected), exprToString(result));
}

test('Natural number expression', function () {
    assert.deepEqual<any>(astNumber(3), parse("3"));
    assert.deepEqual<any>(astNumber(3.5), parse("3.5"));
    assert.deepEqual<any>(astNumber(0), parse("0"));
    assert.deepEqual<any>(astNumber(123), parse("123"));
    assert.deepEqual<any>(astNumber(123.456), parse("123.456"));
    // assert.throws(() => parse("0123")); // TODO: better error message
});

test('Reference expression', function () {
    assert.deepEqual<any>(astRef("a"), parse("a"));
    assert.deepEqual<any>(astRef("abacus"), parse("abacus"));
    assert.deepEqual<any>(astRef("hoot_and_HOLLA"), parse("hoot_and_HOLLA"));
    assert.deepEqual<any>(astRef("h123"), parse("h123"));
    assert.deepEqual<any>(astRef("_123456"), parse("_123456"));
});

test('Call expression', function () {
    assert.deepEqual<any>(astCall(astRef("sin"), []), parse("sin()"));
    assert.deepEqual<any>(astCall(astRef("sin"), [
        astRef("x"),
        astNumber(3),
        astCall(astRef("cos"), [
            astRef("y")
        ])
    ]), parse("sin(x, 3, cos(y))"));
});

test('unary expression', function () {
    assert.deepEqual<any>(astUnary("-", "prefix", astRef("x")), parse("-x"));
    assert.deepEqual<any>(astUnary("-", "prefix", astNumber(3)), parse("-3"));
    assert.deepEqual<any>(astUnary("-", "prefix", astCall(astRef("rand"), [])), parse("-rand()"));
});

test('binary expression', function () {
    assert.deepEqual<any>(astBinary("+", astNumber(2), astNumber(3)), parse("2+3"));
    assert.deepEqual<any>(astBinary("+", astNumber(2), astNumber(3)), parse("(2+3)"));
    assert.deepEqual<any>(astBinary("+", astNumber(2), astNumber(3)), parse("((2+3))"));
});

test('left associative', function () {
    assertExpr(
        astBinary("-", 
            astBinary("-", astNumber(1), astNumber(2)),
            astNumber(3)
        ), parse("1-2-3"));
});

test('right associative', function () {
    assertExpr(
        astBinary("^", 
            astNumber(1),
            astBinary("^", astNumber(2), astNumber(3))
        ), parse("1^2^3"));
});

test('order of operations: 1', function () {
    assertExpr(
        astBinary('+',
            astBinary('*',
                astBinary('^',
                    astNumber(2),
                    astNumber(3)
                ),
                astNumber(4)
            ),
            astNumber(5)
        ), parse("2^3*4+5"));
});

test('order of operations: 2', function () {
    assertExpr(
        astBinary('+',
            astBinary('^',
                astNumber(2),
                astNumber(3)
            ),
            astBinary('*',
                astNumber(4),
                astNumber(5)
            )
        ), parse("2^3+4*5"));
});

test('order of operations: 3', function () {
    assertExpr(
        astBinary('+',
            astNumber(2),
            astBinary('*',
                astNumber(3),
                astBinary('^',
                    astUnary('-', "prefix", astNumber(4)),
                    astNumber(5)
                ),
            )
        ), parse("2+3*-4^5"));
});

suite('binding', function () {
    suite('value', function () {
        var ast = parse('let foo = 3 in foo');
        test('parsing', function () {
            assertExpr(
                astBinding('foo', astNumber(3), astRef('foo')),
                ast
            );
        });

        test('compiling', function () {
            assert.equal('(function (foo) { return foo; })(3)', compileExpr(ast, []));
        });
    });
    suite('function', function () {
        var ast = parse('let add(x, y) = x + y in add(2, 3)');
        test('parsing', function () {
            assertExpr(
                astFunction(
                    'add',
                    [astRef('x'), astRef('y')],
                    astBinary('+',
                        astRef('x'),
                        astRef('y')
                    ),
                    astCall(
                        astRef('add'),
                        [astNumber(2), astNumber(3)]
                    )
                ), ast
            )
        });

        test('compiling', function () {
            assert.equal('(function (add) { return add(2, 3); })(function (x, y) { return (x + y); })', compileExpr(ast, []));
        });
    });
});

suite('if', function () {
    var ast = parse('if 1 > 2 then 100 else 200');
    test('parsing', function () {
        assertExpr(
            astIf(
                astBinary('>', astNumber(1), astNumber(2)),
                astNumber(100),
                astNumber(200)
            ),
            ast
        );
    });

    test('compiling', function () {
        assert.equal('((1 > 2) ? 100 : 200)', compileExpr(ast, []));
    });
});