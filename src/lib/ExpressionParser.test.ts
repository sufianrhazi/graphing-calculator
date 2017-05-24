import { parse, NodeCall, NodeExpr, NodeNumber, NodeOperatorBinary, NodeOperatorUnary, NodeReference } from './ExpressionParser';
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
function astNegate(val: NodeExpr): NodeOperatorUnary {
    return { type: "unary", value: { op: "-", fixity: "prefix", value: val }};
}
function astBinary(op: string, left: NodeExpr, right: NodeExpr): NodeOperatorBinary {
    return { type: "binary", value: { op: op, left: left, right: right } };
}

function exprToString(expr: NodeExpr): string {
    switch (expr.type) {
        case 'binary':
            return `(${exprToString(expr.value.left)} ${expr.value.op} ${exprToString(expr.value.right)})`;
        case 'unary':
            return `(-${exprToString(expr.value.value)})`;
        case 'call':
            return `${exprToString(expr.value.reference)}(${expr.value.args.map(arg => exprToString).join(', ')})`;
        case 'reference':
            return expr.value;
        case 'number':
            return expr.value.toString();
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
    assert.deepEqual<any>(astNegate(astRef("x")), parse("-x"));
    assert.deepEqual<any>(astNegate(astNumber(3)), parse("-3"));
    assert.deepEqual<any>(astNegate(astCall(astRef("rand"), [])), parse("-rand()"));
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
                    astNumber(4),
                    astNumber(5)
                ),
            )
        ), parse("2+3*4^5"));
});