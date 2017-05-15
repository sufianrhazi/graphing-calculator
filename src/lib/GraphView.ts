import * as THREE from "three";
import { InputViewModel } from "./InputViewModel";

export class GraphView {
    private model: InputViewModel;
    private el: HTMLCanvasElement;
    private renderHandle: number | null;
    private resumeTime: number | null;
    private elapsedTime: number;

    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private graphGeo: THREE.Geometry;

    constructor(model: InputViewModel, el: HTMLCanvasElement) {
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
                    var ul = fn(x       , y       , t);
                    var ur = fn(x + STEP, y       , t);
                    var ll = fn(x       , y + STEP, t);
                    var lr = fn(x + STEP, y + STEP, t);
                    this.graphGeo.vertices[offset++].set(x       , ul, y       );
                    this.graphGeo.vertices[offset++].set(x       , ll, y + STEP);
                    this.graphGeo.vertices[offset++].set(x + STEP, ur, y       );
                    this.graphGeo.vertices[offset++].set(x + STEP, lr, y + STEP);
                }
            }
            this.graphGeo.computeFaceNormals();
            this.graphGeo.computeVertexNormals();
            this.graphGeo.verticesNeedUpdate = true;
        };

        update((x: number, y: number, t: number): number => {
            return 0.5 + (
                Math.sin(2 * ((y+x) + t * Math.PI / 3)) +
                Math.cos(2 * ((y-x) + t * Math.PI / 5)) +
                Math.sin(2 * (y + t * Math.PI / 7)) +
                Math.cos(2 * (x + t * Math.PI / 11)) +
                Math.sin(2 * (y + t * Math.PI / 17)) +
                Math.cos(2 * (x + t * Math.PI / 13))
            ) / 12;
        }, sec);

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
        for (var y = MIN; y < MAX; y += STEP) {
            for (var x = MIN; x < MAX; x += STEP) {
                var offset = this.graphGeo.vertices.length;
                this.graphGeo.vertices.push(
                    new THREE.Vector3(0,0,0),
                    new THREE.Vector3(0,0,0),
                    new THREE.Vector3(0,0,0),
                    new THREE.Vector3(0,0,0)
                );
                this.graphGeo.faces.push(
                    new THREE.Face3(offset + 0, offset + 1, offset + 2),
                    new THREE.Face3(offset + 2, offset + 1, offset + 3)
                );
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