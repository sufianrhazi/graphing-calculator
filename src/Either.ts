export class Either<T> {
    private _brand: any; // Fake brand so that these aren't assignable from anything
}

class Left<T> extends Either<T> {
    public readonly val: string;

    constructor(val: string) {
        super();
        this.val = val;
    }
}

export function left<T>(val: string): Left<T> {
    return new Left(val);
}

export function isLeft<T>(either: Either<T>): either is Left<T> {
    return either instanceof Left;
}

class Right<T> extends Either<T> {
    public readonly val: any;

    constructor(val?: any) {
        super();
        this.val = val;
    }
}

export function right<T>(val?: T): Right<T> {
    return new Right(val);
}

export function isRight<T>(either: Either<T>): either is Right<T> {
    return either instanceof Right;
}

export function assertRight<T>(val: Either<T>, msg: string="Assertion Failure"): void {
    if (val instanceof Left) {
        throw new Error(`${msg}: ${val.val}`);
    }
}