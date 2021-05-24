'use strict'


import path from 'path'


function resolve (dir) {
  return path.join(__dirname, dir)
}

module.exports = {
    chainWebpack: config => {
        config.resolve.alias
            .set('@', resolve('src'))
            .set('root', resolve('./'))
    },
    configureWebpack: {
      devtool: 'source-map'
    },
    pluginOptions: {
      electronBuilder: {
        <% if (tsSupport) { %>
        preload: 'src/preload.ts',
        <% } else { %>
        preload: 'src/preload.js',
        <% } %>
        builderOptions: {
          productName: 'xxx',
          appId: 'xxx',
          dmg: {
            contents: [
              {
                x: 410,
                y: 150,
                type: 'link',
                path: '/Applications'
              },
              {
                x: 130,
                y: 150,
                type: 'file'
              }
            ]
          },
          mac: {
            icon: 'build/icons/icon.icns',
            extendInfo: {
              LSUIElement: 1
            }
          },
          win: {
            icon: 'build/icons/icon.ico',
            target: 'nsis'
          },
          nsis: {
            shortcutName: 'xxx',
            oneClick: false,
            allowToChangeInstallationDirectory: true
          },
          linux: {
            icon: 'build/icons/'
          },
        }
      }
    }
}