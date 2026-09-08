"use client";

import React, { useEffect, useRef } from 'react';

interface FisheyeWebGLPreviewProps {
  image: HTMLImageElement;
  method?: 'slider' | 'corners';
  k1?: number;
  k2?: number;
  points?: { x: number; y: number }[];
  zoomFactor?: number;
  width: number;
  height: number;
}

/**
 * Berechnet die projektive Homographie-Matrix (3x3), die ein genormtes
 * Rechteck (0..1) auf die 4 gegebenen Punkte im Quellbild abbildet (Heckbert-Algorithmus).
 * Spalten-weise Anordnung für WebGL uniformMatrix3fv.
 */
function computeHomography(points?: { x: number; y: number }[]): Float32Array {
  if (!points || points.length < 4) {
    return new Float32Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ]);
  }

  const p0 = points[0]; // Oben-Links
  const p1 = points[1]; // Oben-Rechts
  const p2 = points[2]; // Unten-Rechts
  const p3 = points[3]; // Unten-Links

  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sy = p0.y - p1.y + p2.y - p3.y;

  const det = dx1 * dy2 - dx2 * dy1;

  let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0;

  if (Math.abs(det) < 1e-7) {
    // Affiner Fall
    a = p1.x - p0.x;
    b = p3.x - p0.x;
    c = p0.x;
    d = p1.y - p0.y;
    e = p3.y - p0.y;
    f = p0.y;
    g = 0;
    h = 0;
  } else {
    g = (sx * dy2 - sy * dx2) / det;
    h = (dx1 * sy - dy1 * sx) / det;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + h * p3.x;
    c = p0.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + h * p3.y;
    f = p0.y;
  }

  return new Float32Array([
    a, d, g,
    b, e, h,
    c, f, 1.0
  ]);
}

export default function FisheyeWebGLPreview({
  image,
  method = 'slider',
  k1 = 0,
  k2 = 0,
  points,
  zoomFactor = 1.0,
  width,
  height
}: FisheyeWebGLPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) return;
    glRef.current = gl;

    // Vertex- und Fragment-Shader
    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform sampler2D u_image;
      uniform int u_mode; // 0 = Slider (Radial), 1 = Corners (Homographie)
      uniform float u_k1;
      uniform float u_k2;
      uniform float u_zoom;
      uniform mat3 u_homography;
      varying vec2 v_texCoord;

      void main() {
        vec2 uv;
        if (u_mode == 0) {
          // Schieberegler: Radiale Tonnen- / Kissenentzerrung
          vec2 norm = (v_texCoord * 2.0 - 1.0) / u_zoom;
          float r2 = dot(norm, norm);
          float f = 1.0 + u_k1 * r2 + u_k2 * r2 * r2;
          vec2 distorted = norm * f;
          uv = (distorted + 1.0) / 2.0;
        } else {
          // 4-Ecken: Projektive Homographie-Transformation
          vec2 destUV = (v_texCoord - 0.5) / u_zoom + 0.5;
          vec3 srcH = u_homography * vec3(destUV, 1.0);
          if (abs(srcH.z) < 0.00001) {
            uv = vec2(-1.0, -1.0);
          } else {
            uv = srcH.xy / srcH.z;
          }
        }
        
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        } else {
          gl_FragColor = texture2D(u_image, uv);
        }
      }
    `;

    const createShader = (glCtx: WebGLRenderingContext, type: number, source: string) => {
      const shader = glCtx.createShader(type)!;
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      return shader;
    };

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    programRef.current = program;

    // Geometrie-Puffer (Vollbild-Rechteck)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 1,  1, 1,  0, 0,
      0, 0,  1, 1,  1, 0,
    ]), gl.STATIC_DRAW);

    // Textur initialisieren
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    textureRef.current = texture;

  }, [image]);

  useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    gl.viewport(0, 0, width, height);
    gl.useProgram(program);

    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const texCoordLoc = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLoc);
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,1, 1,1, 0,0, 0,0, 1,1, 1,0]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    const modeLoc = gl.getUniformLocation(program, "u_mode");
    const k1Loc = gl.getUniformLocation(program, "u_k1");
    const k2Loc = gl.getUniformLocation(program, "u_k2");
    const zoomLoc = gl.getUniformLocation(program, "u_zoom");
    const homographyLoc = gl.getUniformLocation(program, "u_homography");

    const isCornersMode = method === 'corners';
    gl.uniform1i(modeLoc, isCornersMode ? 1 : 0);
    gl.uniform1f(k1Loc, k1);
    gl.uniform1f(k2Loc, k2);
    gl.uniform1f(zoomLoc, Math.max(0.1, zoomFactor));

    const homographyMatrix = computeHomography(points);
    gl.uniformMatrix3fv(homographyLoc, false, homographyMatrix);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [method, k1, k2, points, zoomFactor, width, height]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="max-w-full h-auto rounded-xl shadow-lg border border-zinc-800"
    />
  );
}
