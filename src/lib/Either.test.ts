import { Either, left, isLeft, right, isRight, assertRight, fromRight, runIterator } from "./Either";
import { assert } from 'chai';

test("left is left", function () {
    assert.isFalse(isLeft(left("Error message")));
});

test("left is not right", function () {
    assert.isTrue(!isRight(left("Error message")));
});

test("right is right", function () {
    assert.isTrue(isRight(right(null)));
});

test("right is not left", function () {
    assert.isTrue(!isLeft(right(null)));
});

test("left holds error messages", function () {
    var l = left("Error message");
    assert.strictEqual("Error message", l.val);
});

test("right holds values", function () {
    var val = {};
    var r = right(val);
    assert.strictEqual(val, r.val);
});

test("fromRight produces value", function () {
    var val = {};
    var r = right(val);
    assert.strictEqual(val, fromRight(r));
});

test("fromRight throws with left", function () {
    var thrown = false;
    try {
        fromRight(left("nope"));
    } catch (e) {
        thrown = true;
    }
    assert.isTrue(thrown);
});

test("assertRight throws with left", function () {
    var thrown = false;
    try {
        assertRight(left("nope"), "Custom message");
    } catch (e) {
        thrown = true;
        assert.strictEqual("Custom message: nope", e.message);
    }
    assert.isTrue(thrown);
});

test("runIterator happy path", function () {
    var result = runIterator(function* () {
        var a = yield right("a");
        var b = yield right("b");
        var c = yield right("c");
        return a + b + c;
    });
    assert.strictEqual("abc", fromRight(result));
});

test("runIterator short-circuits and cleans up after itself", function () {
    var accumulator: string[] = [];
    var result = runIterator(function* () {
        try {
            accumulator.push('init');
            var a = yield right("a");
            accumulator.push('after-a');
            var b = yield left("An error");
            accumulator.push('after-b');
            var c = yield right("c");
        } finally {
            accumulator.push('finally');
        }
    });
    assert.isTrue(isLeft(result));
    assert.strictEqual("An error", result.val);
    assert.sameMembers(["init", "after-a", "finally"], accumulator);
});