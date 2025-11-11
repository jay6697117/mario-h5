// 简单暗角后期效果（Vignette）
export default class VignettePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      renderTarget: true,
      fragShader: `
      precision mediump float;
      uniform sampler2D uMainSampler;
      varying vec2 outTexCoord;
      void main(){
        vec4 color = texture2D(uMainSampler, outTexCoord);
        vec2 uv = outTexCoord - 0.5;
        float d = length(uv);
        float v = smoothstep(0.8, 0.2, d); // 边缘变暗
        gl_FragColor = vec4(color.rgb * v, color.a);
      }
      `,
    });
  }
}

