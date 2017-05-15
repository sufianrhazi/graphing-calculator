declare var globals: any;
declare var process: any;
declare function require(path: string): any;

type TestCase = () => Promise<any> | any;

var tests: TestCase[] = [];

export function assert(prop: boolean, msg: string="Assertion Failed"): void {
    if (!prop) {
        throw new Error(msg);
    }
}

export function test(name: string, body: TestCase): void {
    tests.push(() => {
        console.log(`RUN  ${name}`);
        var promise;
        try {
            promise = body();
        } catch (e) {
            promise = Promise.reject(e);
        }
        if (!(promise instanceof Promise)) {
            promise = Promise.resolve();
        }
        return promise
            .then(function () {
                console.log(`PASS ${name}`);
            }, function (e) {
                console.log(`FAIL ${name}`);
                if (e instanceof Error) {
                    console.log(e.stack);
                }
                return Promise.reject(e);
            })
    });
}

function step(): Promise<undefined> {
    var test = tests.shift();
    if (test === undefined) {
        return Promise.resolve();
    }
    return test().then(function () {
        return step();
    })
}

setTimeout(() => {
    console.log(`Running ${tests.length} tests...`);
    step()
        .then(() => {
            console.log('All tests pass');
            process.exit(0);
        }, () => {
            console.log('TEST FAILURE');
            process.exit(1);
        })
}, 0);