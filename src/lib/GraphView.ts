import * as THREE from "three";
import { GraphModel } from "./GraphModel";

export class GraphView {
    private model: GraphModel;
    private el: HTMLCanvasElement;
    private renderHandle: number | null;
    private resumeTime: number | null;
    private elapsedTime: number;

    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private graphGeo: THREE.Geometry;

    constructor(model: GraphModel, el: HTMLCanvasElement) {
        this.model = model;
        this.el = el;
        this.renderHandle = null;
        this.resumeTime = null;
        this.elapsedTime = 0;
        this.model.listen((data: string) => {
            if (data === 'running' || data === 'paused') {
                if (this.model.getIsRunning() && !this.model.getIsPaused()) {
                    this.resumeRender();
                } else {
                    this.stopRender();
                }
            }
        });

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.el
        });
        this.renderer.setClearColor(0xffffff);
        this.initScene();
    }

    private resumeRender(): void {
        if (this.renderHandle !== null) {
            console.trace('This should never happen: double resume');
            return;
        }
        this.resumeTime = performance.now();
        this.render();
    }

    private stopRender(): void {
        if (this.renderHandle === null) {
            console.trace('This should never happen: double stop');
            return;
        }
        cancelAnimationFrame(this.renderHandle);
        if (this.resumeTime === null) {
            throw new Error("This should never happen: resumeTime is null");
        }
        if (this.model.getIsPaused()) {
            this.elapsedTime += performance.now() - this.resumeTime;
        }
        if (!this.model.getIsRunning()) {
            this.elapsedTime = 0;
        }
        this.renderHandle = null;
    }

    private render(): void {
        if (this.resumeTime === null) {
            throw new Error("This should never happen: resumeTime is null");
        }
        var currentTime = (this.elapsedTime + performance.now() - this.resumeTime) / 1000;
        this.updateScene(currentTime);
        this.renderer.render(this.scene, this.camera);
        this.renderHandle = requestAnimationFrame(() => {
            this.renderHandle = null;
            this.render();
        });
    }

    private updateScene(sec: number): void {
        var update = (fn: (x: number, y: number, t: number) => number, t: number) => {
            var offset = 0;
            var MIN = this.model.getMin();
            var MAX = this.model.getMax();
            var STEP = this.model.getStep();
            for (var y = MIN; y < MAX; y += STEP) {
                for (var x = MIN; x < MAX; x += STEP) {
                    this.graphGeo.vertices[offset++].set(x, fn(x, y, t), y);
                }
            }
            this.graphGeo.computeFaceNormals();
            this.graphGeo.computeVertexNormals();
            this.graphGeo.verticesNeedUpdate = true;
        };

        update(this.model.getFunc(), sec);
        
        this.camera.position.set(
            8 * Math.sin(Math.PI / 4 + Math.PI * 2 * sec / 300),
            4,
            8 * Math.cos(Math.PI / 4 + Math.PI * 2 * sec / 300)
        );
        this.camera.lookAt(new THREE.Vector3(0, 1, 0));
    }

    private initScene(): void {
        this.scene = new THREE.Scene();

        var ptLight = new THREE.PointLight(0xffffff, 1, 30);
        ptLight.position.set(0, 6, 0);
        this.scene.add(ptLight);

        this.camera = new THREE.PerspectiveCamera(50, this.el.height / this.el.width, 0.1, 500);

        var MIN = this.model.getMin();
        var MAX = this.model.getMax();
        var STEP = this.model.getStep();

        var axisGrid = new THREE.GridHelper(MAX - MIN, (MAX - MIN) / STEP);
        this.scene.add(axisGrid);

        this.graphGeo = new THREE.Geometry();
        var ySteps = Math.floor((MAX - MIN) / STEP);
        var xSteps = Math.floor((MAX - MIN) / STEP);
        for (var y = 0; y < ySteps; ++y) {
            for (var x = 0; x < xSteps; ++x) {
                this.graphGeo.vertices.push(
                    new THREE.Vector3(0,0,0)
                );
                if (y > 0 && x > 0) {
                    // at each point greater than zero, add two
                    // triangles to construct the previous tile
                    // 1: center; up-left; up
                    // 2: up-left, center; left
                    var offset = y * ySteps + x;
                    this.graphGeo.faces.push(
                        new THREE.Face3(offset, offset - ySteps - 1, offset - ySteps),
                        new THREE.Face3(offset - ySteps - 1, offset, offset - 1)
                    );
                }
            }
        }
        var graphMat = new THREE.MeshLambertMaterial({
            color: 0x000080,
            side: THREE.DoubleSide
        });
        var graphMesh = new THREE.Mesh(this.graphGeo, graphMat);
        this.scene.add(graphMesh);
    }
}