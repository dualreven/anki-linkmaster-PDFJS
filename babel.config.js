module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: '> 0.25%, not dead'
        }
      }
    ]
  ],
  plugins: [
    '@babel/plugin-proposal-private-methods',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-transform-private-methods',
    '@babel/plugin-transform-class-properties'
  ]
};