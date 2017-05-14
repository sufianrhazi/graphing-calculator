type Constructor<T> = Function & { new(...args: any[]): T, prototype: T };

function isConstructedBy<T>(instance: any, klass: Constructor<T>): instance is T {
    return instance instanceof klass;
}

export function qs(root: Element, selector: string): Element | null {
    return root.querySelector(selector);
}

export function getOne<T extends Element>(root: Element, selector: string, Kind: Constructor<T>): T {
    var contender = qs(root, selector);
    if (contender === null) {
        throw new Error(`No elements matching selector "${selector}"`);
    }
    if (isConstructedBy(contender, Kind)) {
        return contender;
    }
    throw new Error(`First element matching selector "${selector}" not a "${Kind.name}"`);
}

export function qsa(root: Element, selector: string): Element[] {
    return Array.from(root.querySelectorAll(selector));
}

export function getAllOfType<T extends Element>(root: Element, selector: string, Kind: Constructor<T>): T[] {
    var contenders = qsa(root, selector);
    var items: T[] = [];
    for (var el of contenders) {
        if (isConstructedBy(el, Kind)) {
            items.push(el);
        }
    }
    return items;
}

export function on<K extends keyof HTMLElementEventMap>(el: Element, name: K, selector: string, handler: EventListener, isCapture: boolean = false) {
    var eventHandler: EventListener | null = null;
    var off = function () {
        if (eventHandler !== null) {
            el.removeEventListener(name, eventHandler, isCapture);
            eventHandler = null;
        }
    }
    eventHandler = function (event: Event) {
        if (event.currentTarget instanceof Element) {
            var subEl = qsa(event.currentTarget, selector).find(function (contender) {
                return contender === event.target;
            });
            if (subEl !== undefined) {
                return handler.call(subEl, event);
            }
        }
    }
    el.addEventListener(name, eventHandler, isCapture);
    return off;
}