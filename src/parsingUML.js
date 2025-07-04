const fs = require('fs');
const path = require('path');
const projectClasses = require('./project')

function readUMLfile(folder) {
    const filePath = path.join(folder, 'diagram.puml');
    const uml = fs.readFileSync(filePath, 'utf8');
    const project = new projectClasses.Project();
    //TODO: make project from uml
    return project
}