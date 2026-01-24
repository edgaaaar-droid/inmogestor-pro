const ghpages = require('gh-pages');

console.log('Iniciando despliegue...');

// Run verification first
try {
    const { execSync } = require('child_process');
    console.log('Ejecutando verificación de versiones...');
    execSync('node verify-versions.js', { stdio: 'inherit' });
} catch (e) {
    console.error('❌ Verificación fallida. Abortando despliegue.');
    process.exit(1);
}

ghpages.publish('.', {
    src: [
        '**/*',
        '!dist/**',
        '!dist-packager/**',
        '!node_modules/**',
        '!.git/**',
        '!.github/**',
        '!.vscode/**',
        '!deploy.js'
    ],
    branch: 'gh-pages',
    dotfiles: true
}, function (err) {
    if (err) {
        console.error('❌ Error en el despliegue:', err);
        process.exit(1);
    } else {
        console.log('✅ Despliegue completado exitosamente.');
    }
});
