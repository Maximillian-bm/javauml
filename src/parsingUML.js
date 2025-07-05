const fs = require('fs');
const path = require('path');
const projectClasses = require('./project')

function readUMLfile(folder) {
    const filePath = path.join(folder, 'diagram.puml');
    const uml = fs.readFileSync(filePath, 'utf8');
    const lines = uml.split('\n');
    const currentLine = [0];
    const project = new projectClasses.Project();
    while(currentLine < lines.length){
        if(isClass(lines, currentLine)){
            project.addClass(createClass(lines, currentLine));
        }else if(isPackage(lines, currentLine)){
            project.addPackage(createPackage(lines, currentLine));
        }else{
            currentLine[0]++;
        }
    }
    return project
}

function readClassesAndPackages(lines, currentLine){
    currentLine[0]++;
    const classes = [];
    const packages = [];
    while(!lines[currentLine[0]].includes('}')){
        if(isClass(lines, currentLine)){
            classes.push(createClass(lines, currentLine));
        }else if(isPackage(lines, currentLine)){
            packages.push(createPackage(lines, currentLine));
        }else{
            currentLine[0]++;
        }
    }
    currentLine[0]++;
    return [packages, classes];
}

function createPackage(lines, currentLine){
    const name = 'todo';
    const packageBody = readClassesAndPackages(lines, currentLine);
    return new projectClasses.Package(name, packageBody[1], packageBody[0]);
}

function createClass(lines, currentLine){
    const parts = lines[currentLine[0]].split(' ');
    const name = parts[1];
    const isAbstract = parts.includes('abstract');
    const isInterface = parts.includes('interface');
    const isEnum = parts.includes('enum');
    const clazz = new projectClasses.Class(name, [], [], null, [], [], isAbstract, isInterface, isEnum);
    while(!lines[currentLine[0]].includes('}')){
        currentLine[0]++;
    }
    currentLine[0]++;
    return clazz;
}

function isClass(lines, currentLine){
    const parts = lines[currentLine[0]].split(' ');
    if(parts.includes('class') || parts.includes('abstract') || parts.includes('interface') || parts.includes('enum')){
        return true;
    }else{
        return false;
    }
}

function isPackage(lines, currentLine){
    const parts = lines[currentLine[0]].split(' ');
    if(parts.includes('package')){
        return true;
    }else{
        return false;
    }
}

module.exports = {
    readUMLfile
};