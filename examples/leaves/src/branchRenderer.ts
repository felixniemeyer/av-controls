import { Branch } from './branch';
import { createProgram } from './shaderUtils'; 

import vs from './shaders/branch.vs.glsl?raw';
import fs from './shaders/branch.fs.glsl?raw';

import quadVs from './shaders/quad.vs.glsl?raw';
import quadFS from './shaders/quad.fs.glsl?raw';

console.log(vs);
console.log(fs);

export class BranchRenderer {
  private gl: WebGL2RenderingContext;
  private branches: Branch[];
  private instanceBuffer: WebGLBuffer;
  private instanceCount: number;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject | null;
  private respawnRadius: number = 1

  private quadProgram: WebGLProgram;
  private quadVao: WebGLVertexArrayObject | null;

  constructor(gl: WebGL2RenderingContext, branchCount: number) {
    this.gl = gl;
    this.branches = [];
    this.instanceCount = branchCount;

    this.program = createProgram(this.gl, vs, fs);

    this.instanceBuffer = this.gl.createBuffer();
    if (!this.instanceBuffer) {
      throw new Error('Failed to create instance buffer');
    }

    this.vao = null;
    this.initializeBranches();
    this.setupInstanceBuffer();

    // quad
    this.quadProgram = createProgram(this.gl, quadVs, quadFS);
    this.quadVao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.quadVao);
    const quadBuffer = this.gl.createBuffer();
    const data = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, quadBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
    const positionLocation = this.gl.getAttribLocation(this.quadProgram, 'position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.bindVertexArray(null);

    this.setLeafScale(1);
  }

  private setLeafScale(leafScale: number) {
    this.gl.useProgram(this.program);
    this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'leafScale'), leafScale);
    this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'wiggleFrequency'), 100 / leafScale);
    this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'invLeafScale'), 1 / leafScale);
  }

  private initializeBranches() {
    for (let i = 0; i < this.instanceCount; i++) {
      this.branches.push(new Branch());
    }
  }

  private setupInstanceBuffer() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
    
    const instanceData = new Float32Array(this.instanceCount * 4); // x, y, angle, scale for each branch
    this.gl.bufferData(this.gl.ARRAY_BUFFER, instanceData, this.gl.DYNAMIC_DRAW);

    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    // Set up instance data (posRotScale)
    const instanceDataLocation = this.gl.getAttribLocation(this.program, 'posRotScale');
    this.gl.enableVertexAttribArray(instanceDataLocation);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
    this.gl.vertexAttribPointer(instanceDataLocation, 4, this.gl.FLOAT, false, 0, 0);
    this.gl.vertexAttribDivisor(instanceDataLocation, 1);

    const colorData = new Float32Array(this.instanceCount * 4);
    for (let i = 0; i < this.instanceCount; i++) {
      const branch = this.branches[i];
      colorData.set(branch.baseColor, i * 4);
      colorData[i * 4 + 3] = branch.style;
    }
    const colorBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, colorData, this.gl.STATIC_DRAW);

    const colorDataLocation = this.gl.getAttribLocation(this.program, 'colorAndStyle');
    this.gl.enableVertexAttribArray(colorDataLocation);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.vertexAttribPointer(colorDataLocation, 4, this.gl.FLOAT, false, 0, 0);
    this.gl.vertexAttribDivisor(colorDataLocation, 1);

    // Set up vertex data (position)
    const vertexBuffer = this.gl.createBuffer();
    const vertexData = new Float32Array([
        1, 1,  
        0, 0,  
        2, 0,  
        1, -1,  
    ]);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.STATIC_DRAW);
    const positionLocation = this.gl.getAttribLocation(this.program, 'position');
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.bindVertexArray(null);
  }

  public update(deltaTime: number) {
    this.branches.forEach(branch => {
      branch.update(deltaTime, this.respawnRadius);
    });
  }

  private updateInstanceBuffer() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
    const instanceData = new Float32Array(this.instanceCount * 4);
    for (let i = 0; i < this.instanceCount; i++) {
      const branch = this.branches[i];
      const x = branch.position[0]; 
      const y = branch.position[1];
      const angle = branch.getAngle(); 
      const scale = branch.getScale();
      instanceData.set([x, y, angle, scale], i * 4);
    }
    this.gl.bufferData(this.gl.ARRAY_BUFFER, instanceData, this.gl.DYNAMIC_DRAW); // Use DYNAMIC_DRAW for updates
  }

  public resize(width: number, height: number) {
    const w = Math.sqrt(width/height)
    const h = 1/w

    this.gl.viewport(0, 0, width, height);
    this.gl.useProgram(this.program);
    this.gl.uniform2fv(this.gl.getUniformLocation(this.program, 'worldScale'), [1/w, 1/h])

    this.gl.clearColor(0,0,0,0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    this.respawnRadius = Math.max(w, h);

  }

  private darkenCount = -60
  public render() {
    if(this.darkenCount > 0) {
      this.darkenFrameBuffer(); 
      this.darkenCount = -60
    }
    this.darkenCount++

    this.updateInstanceBuffer(); // Update instance data if needed

    this.gl.useProgram(this.program);

    this.gl.bindVertexArray(this.vao);

    // this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    this.gl.drawArraysInstanced(this.gl.TRIANGLE_STRIP, 0, 4, this.instanceCount);

    this.gl.bindVertexArray(null);

    // enable normal alpha blending
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    this.gl.bindVertexArray(null);
  }

  // render a full screen quad with a dark color and low alpha
  private darkenFrameBuffer() {
    this.gl.useProgram(this.quadProgram);
    this.gl.bindVertexArray(this.quadVao);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    this.gl.bindVertexArray(null);
  }
}
