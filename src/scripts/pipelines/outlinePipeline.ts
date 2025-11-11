// 像素风轮廓描边（shader 实现，1px 厚度）
export default class OutlinePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      renderTarget: true,
      fragShader: `
      precision mediump float;
      uniform sampler2D uMainSampler;
      varying vec2 outTexCoord;
      uniform vec2 resolution;
      void main(){
        vec4 c = texture2D(uMainSampler, outTexCoord);
        float a = c.a;
        if(a > 0.0){ gl_FragColor = c; return; }
        vec2 px = vec2(1.0 / resolution.x, 1.0 / resolution.y);
        float alpha = 0.0;
        alpha += texture2D(uMainSampler, outTexCoord + vec2(px.x, 0.0)).a;
        alpha += texture2D(uMainSampler, outTexCoord + vec2(-px.x, 0.0)).a;
        alpha += texture2D(uMainSampler, outTexCoord + vec2(0.0, px.y)).a;
        alpha += texture2D(uMainSampler, outTexCoord + vec2(0.0, -px.y)).a;
        if(alpha > 0.0){ gl_FragColor = vec4(0.0, 0.0, 0.0, 0.8); } else { gl_FragColor = c; }
      }
      `,
    });
  }

  onPreRender(){
    const renderer: any = this.game.renderer;
    const w = renderer.width;
    const h = renderer.height;
    this.set2f('resolution', w, h);
  }
}

