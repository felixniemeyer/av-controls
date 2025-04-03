import { vec2 } from 'gl-matrix';

export class Branch {
    private angleOffset: number = 0;
    private nextLeafSize: number = 0;
    public scale

    constructor(
        public position: vec2 = vec2.create(),
        public angle: number = Math.random() * 2 * Math.PI,
        public pulseFrequency: number = 1 + Math.random(), 
        public leafSize: number = Math.random() * 0.05 + 0.05, 
        public velocity: number = leafSize * (Math.random() * 0.4 + 0.1), 
        public growRate: number = Math.random() * 0.05 + 0.05,
        public rotation: number = (Math.random() * 0.02 + 0.01) * 2 * Math.PI
    ) {
        console.log('position', this.position)
        this.nextLeafSize = this.leafSize * (Math.random() + 0.5)
        this.scale = Math.random() * this.nextLeafSize
    }

    // Update position based on velocity
    update(deltaTime: number): void {
        this.scale += this.growRate * deltaTime;
        if(this.scale > this.nextLeafSize) {
            this.scale = 0;
            const v = vec2.fromValues(
                Math.cos(this.angle),
                Math.sin(this.angle)
            );
            this.angleOffset = Math.random() * 2 - 1
            vec2.scaleAndAdd(this.position, this.position, v, this.velocity);
            this.angle += this.rotation;
            if(Math.random() < 0.03) {
                this.rotation = -this.rotation;
            }
        }
    }

    getAngle(): number {
        return -this.angle + this.angleOffset;
    }
} 