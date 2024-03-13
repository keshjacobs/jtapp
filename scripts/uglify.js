const fs = require('fs');
const UglifyJS = require('uglify-js');

const inputFilePath = 'www/engine/app.js'; // Adjust the path to your main JavaScript file
const outputFilePath = 'www/engine/app.min.js'; // Adjust the desired output path

const inputCode = fs.readFileSync(inputFilePath, 'utf8');
const minifiedCode = UglifyJS.minify(inputCode);

fs.writeFileSync(outputFilePath, minifiedCode.code);
