const fs = require('fs')
const path = require('path')
const fse = require('fs-extra')
const { warn } = require('@vue/cli-shared-utils')
const { isConstructSignatureDeclaration } = require('typescript')

module.exports = (api, options = {}) => {
  if (!options.electronBuilder) options.electronBuilder = {}
  const electronVersion = options.electronBuilder.electronVersion
  let pkg = fs.readFileSync(api.resolve('./package.json'), 'utf8')
  pkg = JSON.parse(pkg)
  const usesTS = api.hasPlugin('typescript')
  const hasBackground =
    fs.existsSync(api.resolve('./src/background.ts')) ||
    fs.existsSync(api.resolve('./src/background.js'))

  if (!hasBackground) {
    // If user does not have a background file it should be created
    api.render('./templates/base', {
      spectronSupport: options.electronBuilder.addTests,
      tsSupport: usesTS
    })
  }
  // Add tests
  let testFramework
  if (options.electronBuilder.addTests) {
    if (api.hasPlugin('unit-mocha')) testFramework = 'mocha'
    if (api.hasPlugin('unit-jest')) testFramework = 'jest'
    if (testFramework) api.render(`./templates/tests-${testFramework}`)
  }
  api.onCreateComplete(() => {
    // Update .gitignore if it exists
    if (fs.existsSync(api.resolve('./.gitignore'))) {
      let gitignore = fs.readFileSync(api.resolve('./.gitignore'), 'utf8')
      if (!gitignore.match(/(#Electron-builder output|\/dist_electron)/)) {
        // Add /dist_electron to gitignore if it doesn't exist already
        gitignore = gitignore + '\n#Electron-builder output\n/dist_electron'
        fs.writeFileSync(api.resolve('./.gitignore'), gitignore)
      }
    }

    if (usesTS) {
      let background
      if (fs.existsSync(api.resolve('./src/background.js'))) {
        background = fs.readFileSync(api.resolve('./src/background.js'), 'utf8')
        fs.unlinkSync(api.resolve('./src/background.js'))
      } else if (fs.existsSync(api.resolve('./src/background.ts'))) {
        background = fs.readFileSync(api.resolve('./src/background.ts'), 'utf8')
      } else {
        // Exit if background file cannot be found
        return
      }
      background = background.replace(
        // Add types if they don't exist
        /process\.env\.WEBPACK_DEV_SERVER_URL\s*?\)$/m,
        'process.env.WEBPACK_DEV_SERVER_URL as string)'
      )
      background = background.replace(
        'process.env.ELECTRON_NODE_INTEGRATION',
        '(process.env\n          .ELECTRON_NODE_INTEGRATION as unknown) as boolean'
      )
      fs.writeFileSync(api.resolve('./src/background.ts'), background)


      if(fs.existsSync(api.resolve('./src/preload.js'))) {
        fse.moveSync(api.resolve('./src/preload.js'), api.resolve('./src/preload.ts'))
      }

      if(!fs.existsSync(api.resolve('./src/main/index.js'))) {
        fse.moveSync(api.resolve('./src/main/index.js'), api.resolve('./src/main/index.ts'))
      }

    }
    if (api.hasPlugin('router')) {
      console.log('\n')
      warn(
        'It is detected that you are using Vue Router. It must function in hash mode to work in Electron. Learn more at https://goo.gl/GM1xZG .'
      )
    }

    fse.ensureDirSync(api.resolve('./src/render'))
    const datas = ['assets', 'components', 'router', 'views', 'store', 'App.vue']
    datas.forEach(item => {
      const dst = api.resolve(path.join('./src/render', item))
      const src = api.resolve(path.join('./src', item))
      if(fs.existsSync(src) && !fs.existsSync(dst)) {
        fse.moveSync(src, dst) 
      }
    })

    if(usesTS) {
      fse.ensureDirSync(api.resolve('./src/common/types'), {'recursive': true})
          fs.readdirSync(api.resolve('./src')).forEach(item => {
              if(item.endsWith('.d.ts')) {
                const dst = api.resolve(path.join('./src/common/types', item))
                const src = api.resolve(path.join('./src', item))
                if(!fs.existsSync(dst)) {
                  fse.moveSync(src, dst)
                }
              } 
          })

      const tsCfg = fse.readJSONSync(api.resolve('./tsconfig.json'))
      if(!tsCfg.compilerOptions['typeRoots']) {
        tsCfg.compilerOptions['typeRoots'] = ['./src/common/types/*']
      }
      fse.writeJSONSync(api.resolve('./tsconfig.json'), tsCfg, options = {spaces:2})
    }

  })

  // Add electron-builder install-app-deps to postinstall and postuninstall
  const scripts = {
    'build': 'vue-cli-service electron:build',
    'serve': 'vue-cli-service electron:serve'
  }
  const addScript = (name, command) => {
    // Add on to existing script if it exists
    if (pkg.scripts && pkg.scripts[name]) {
      // Don't re-add script
      if (!pkg.scripts[name].match(command)) {
        // add command to existing script
        scripts[name] = pkg.scripts[name] + ` && ${command}`
      } else {
        // command already exists, don't change it
        scripts[name] = pkg.scripts[name]
      }
    } else {
      // Create new postinstall script
      scripts[name] = command
    }
  }
  addScript('postinstall', 'electron-builder install-app-deps')
  addScript('postuninstall', 'electron-builder install-app-deps')
  const devDependencies = {
    'electron-devtools-installer': '^3.1.0'
  }
  if (electronVersion) {
    // Use provided electron version
    devDependencies.electron = electronVersion
  }
  if (usesTS) {
    devDependencies['@types/electron-devtools-installer'] = '^2.2.0'
  }
  const dependencies = {}
  if (testFramework) {
    // Spectron version should be electron version + 2
    devDependencies.spectron =
      parseInt(
        (electronVersion || pkg.devDependencies.electron).match(/^\^(\d*)\./)[1]
      ) +
      2 +
      '.0.0'
  }
  if (testFramework === 'mocha') {
    devDependencies['chai-as-promised'] = '^7.1.1'
  }
  api.extendPackage({
    scripts,
    dependencies,
    devDependencies,
    main: 'background.js'
  })
}
