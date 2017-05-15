import { qs, qsa, on, getOne } from './lib/SimpleDOM';
import { left, right } from './lib/Either';
import { InputViewModel } from './lib/InputViewModel';
import { InputView } from './lib/InputView';
import { GraphView } from './lib/GraphView';

var inputModel = new InputViewModel({
    min: parseFloat(getOne(document.body, '[name="min"]', HTMLInputElement).value),
    max: parseFloat(getOne(document.body, '[name="max"]', HTMLInputElement).value),
    func: getOne(document.body, '[name="func"]', HTMLTextAreaElement).value,
    time: 0,
});
var inputView = new InputView(inputModel, getOne(document.body, '[data-form]', Element));
var graphView = new GraphView(inputModel, getOne(document.body, '[data-graph-canvas]', HTMLCanvasElement));