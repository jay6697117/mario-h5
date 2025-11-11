const path = require('path')
const merge = require('webpack-merge')
const common = require('./webpack.common')
const JavaScriptObfuscator = require('webpack-obfuscator')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

const prod = {
  mode: 'production',
  output: {
    filename: '[name].[contenthash].bundle.js',
    chunkFilename: '[name].[contenthash].chunk.js'
  },
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      // 使用默认文件名规则（output.filename/chunkFilename），避免与按需加载冲突
    }
  },
  performance: {
    assetFilter: (filename) => /\.(js|css)$/.test(filename)
  },
  plugins: [
    new CleanWebpackPlugin({ cleanOnceBeforeBuildPatterns: [path.resolve(__dirname, '../dist/*.js')] }),
    new JavaScriptObfuscator(
      {
        rotateStringArray: true,
        stringArray: true,
        // stringArrayEncoding: 'base64', // disabled by default
        stringArrayThreshold: 0.75
      },
      ['vendors.*.js']
    )
  ]
}

module.exports = merge(common, prod)
