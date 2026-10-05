import {
	ACESFilmicToneMapping,
	Box3,
	DirectionalLight,
	Group,
	Mesh,
	HemisphereLight,
	MathUtils,
	Object3D,
	PCFSoftShadowMap,
	PerspectiveCamera,
	PMREMGenerator,
	Scene,
	SRGBColorSpace,
	Vector3,
	WebGLRenderer
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface View {
	/** degrees, positive turns the figure to its left */
	yaw: number;
	/** degrees, positive looks from above */
	pitch: number;
	/** 1 = default framing */
	zoom: number;
}

const FOV = 20;
/** Zoom at which the whole figure is in view */
export const MIN_ZOOM = 0.4;

/** Offscreen renderer with a transparent background. */
export class Stage {
	readonly renderer: WebGLRenderer;
	private scene = new Scene();
	private camera = new PerspectiveCamera(FOV, 1, 1, 5000);
	private pivot = new Group();
	private model: Object3D | null = null;

	constructor() {
		this.renderer = new WebGLRenderer({
			antialias: true,
			alpha: true,
			preserveDrawingBuffer: true
		});
		this.renderer.setClearColor(0x000000, 0);
		this.renderer.outputColorSpace = SRGBColorSpace;
		this.renderer.toneMapping = ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = PCFSoftShadowMap;

		const pmrem = new PMREMGenerator(this.renderer);
		this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
		this.scene.environmentIntensity = 0.14;

		// Hard key light from the upper left leaves the lower right in shadow,
		// like the 2005-era game portraits. A faint cool rim keeps the outline.
		const key = new DirectionalLight(0xfff2e0, 3.2);
		key.position.set(-230, 180, 115);
		key.castShadow = true;
		key.shadow.mapSize.set(1024, 1024);
		key.shadow.bias = -0.002;
		key.shadow.normalBias = 1.5;
		Object.assign(key.shadow.camera, {
			left: -60,
			right: 60,
			top: 60,
			bottom: -60,
			near: 1,
			far: 800
		});
		const rim = new DirectionalLight(0x9fb4ff, 0.5);
		rim.position.set(160, 60, -200);
		const fill = new HemisphereLight(0xc8d0ff, 0x0c0a16, 0.22);
		this.scene.add(key, key.target, rim, fill, this.pivot);
	}

	setModel(model: Object3D | null) {
		if (this.model) this.pivot.remove(this.model);
		this.model = model;
		if (model) this.pivot.add(model);
	}

	/**
	 * Portrait framing: the camera aims at `focus` (usually head + headgear),
	 * a bit low so the shoulders show, and scales with its size. Zooming out
	 * below 1 slides towards `body`, the whole figure.
	 */
	frame(focus: Box3, body: Box3, view: View) {
		const size = focus.getSize(new Vector3());
		const center = focus.getCenter(new Vector3());
		const extent = Math.max(size.y * 2.05, size.x * 2, 70);
		const target = new Vector3(center.x, center.y - extent * 0.08, center.z);
		if (view.zoom >= 1 || body.isEmpty()) return this.aim(target, extent / view.zoom, view);

		const t = MathUtils.smoothstep(1 - view.zoom, 0, 1 - MIN_ZOOM);
		const bodySize = body.getSize(new Vector3());
		// The disc is round: the whole figure has to fit inside the circle, not the square
		const whole = Math.max(bodySize.y, bodySize.x) * 1.6;
		this.aim(target.lerp(body.getCenter(new Vector3()), t), MathUtils.lerp(extent, whole, t), view);
	}

	/** Fits the whole model, for thumbnails. */
	fit(view: View) {
		if (!this.model) return;
		const box = new Box3().setFromObject(this.model);
		const size = box.getSize(new Vector3());
		this.aim(box.getCenter(new Vector3()), Math.max(size.x, size.y, size.z) * 1.15, view);
	}

	private aim(target: Vector3, extent: number, view: View) {
		this.pivot.rotation.y = MathUtils.degToRad(view.yaw);
		const distance = extent / 2 / Math.tan(MathUtils.degToRad(FOV / 2));
		const pitch = MathUtils.degToRad(view.pitch);
		this.camera.position.set(
			target.x,
			target.y + Math.sin(pitch) * distance,
			target.z + Math.cos(pitch) * distance
		);
		this.camera.near = distance / 10;
		this.camera.far = distance * 10;
		this.camera.lookAt(target);
		this.camera.updateProjectionMatrix();
	}

	/** Bounding box of the given children of the model, in world space. */
	/** With no names, the whole model. */
	box(names?: string[]) {
		const box = new Box3();
		// Measured facing the camera, so framing does not move when turning
		this.pivot.rotation.y = 0;
		this.pivot.updateMatrixWorld(true);
		this.model?.traverse((o) => {
			if (o instanceof Mesh && (!names || names.some((n) => isIn(o, n)))) box.expandByObject(o);
		});
		return box;
	}

	render(size: number) {
		this.renderer.setPixelRatio(1);
		this.renderer.setSize(size, size, false);
		this.renderer.render(this.scene, this.camera);
		return this.renderer.domElement;
	}
}

function isIn(o: Object3D, name: string) {
	for (let p: Object3D | null = o; p; p = p.parent) if (p.name === name) return true;
	return false;
}
