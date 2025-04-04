import { vec2, vec3 } from 'gl-matrix';

function randomLeafColor(): vec3 {
    const randComponent = () => Math.random() * 0.5 + 0.25;
    const result = vec3.fromValues(
        randComponent(), 
        randComponent(), 
        randComponent()
    )

    result[0] += result[2]; 

    vec3.normalize(result, result) 

    vec3.lerp(result, result, vec3.fromValues(0.1, 0.4, 0.2), 0.4 + Math.random() * 0.6)

    return result;
}

export class Branch {
    private angleOffset: number = 0;
    private currentLeafSize: number = 0;

    private accumulatedRotation: number = 0; 
    private nextTurnAfter: number = 0;

    public scale

    constructor(
        public position: vec2 = vec2.create(),
        public angle: number = Math.random() * 2 * Math.PI,
        public pulseFrequency: number = 1 + Math.random(), 
        public leafSize: number = Math.random() * 0.05 + 0.05, 
        public velocity: number = leafSize * (Math.random() * 0.3 + 0.1), 
        public growRate: number = Math.random() * 0.5 + 0.5,
        public rotation: number = (Math.random() * 0.02 + 0.01) * 2 * Math.PI,
        public baseColor: vec3 = randomLeafColor(),
        public style: number = Math.random()
    ) {
        this.scale = Math.random() * this.currentLeafSize
        this.nextLeaf();
        if(Math.random() < 0.5) {
            this.rotation = -this.rotation;
        }
    }

    nextLeaf() {
        this.currentLeafSize = this.leafSize * (0.8 + Math.random() * 0.4)
        this.nextTurnAfter = (Math.random() + 0.25) * Math.PI * 2 
    }

    // Update position based on velocity
    update(deltaTime: number, respawnRadius: number): void {
        this.scale += this.growRate * deltaTime;
        if(this.scale > 1) {
            this.scale = 0;
            this.nextLeaf();
            const v = vec2.fromValues(
                Math.cos(this.angle),
                Math.sin(this.angle)
            );
            this.angleOffset = Math.random() * 2 - 1
            vec2.scaleAndAdd(this.position, this.position, v, this.velocity);
            this.angle += this.rotation;
            this.accumulatedRotation += this.rotation;
            if(Math.abs(this.accumulatedRotation) > this.nextTurnAfter) {
                this.rotation = -this.rotation;
                this.accumulatedRotation = 0;
            }
            if(Math.abs(this.position[0]) > respawnRadius || Math.abs(this.position[1]) > respawnRadius) {
                this.position = vec2.create();
            }
        }
    }

    getAngle(): number {
        return -this.angle + this.angleOffset;
    }

    getScale(): number {
        return ((1. - Math.cos(this.scale * Math.PI)) * 0.5) * this.currentLeafSize
    }
} 