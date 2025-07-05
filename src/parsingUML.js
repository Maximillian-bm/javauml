const fs = require('fs');
const path = require('path');
const projectClasses = require('./project')

function readUMLfile(folder) {
    const filePath = path.join(folder, 'diagram.puml');
    const uml = fs.readFileSync(filePath, 'utf8');
    const lines = uml.split('/n');
    var currentLine = 0;
    const project = new projectClasses.Project();
    while(currentLine < lines.length){
        if(isClass(lines, currentLine)){
            project.addClass(createClass(lines, currentLine));
        }else if(isPackage(lines, currentLine)){
            project.addPackage(createPackage(lines, currentLine));
        }else{
            currentLine++;
        }
    }
    return project
}

function readClassesAndPackages(lines, currentLine){
    const classes = [];
    const packages = [];
    while(!lines[currentLine].include('}')){
        if(isClass(lines, currentLine)){
            classes.push(createClass(lines, currentLine));
        }else if(isPackage(lines, currentLine)){
            packages.push(createPackage(lines, currentLine));
        }else{
            currentLine++;
        }
    }
    currentLine++;
    return [packages, classes];
}

function createPackage(lines, currentLine){
    const name = 'todo';
    const packageBody = readClassesAndPackages(lines, currentLine);
    return new projectClasses.Package(name, packageBody[1], packageBody[0]);
}

function createClass(lines, currentLine){
    const parts = lines[currentLine].split(' ');
    const name = parts[1];
    const isAbstract = parts.include('abstract');
    const isInterface = parts.include('interface');
    const isEnum = parts.include('enum');
    const clazz = new projectClasses.Class(name, [], [], null, [], [], isAbstract, isInterface, isEnum);
    while(!lines[currentLine].include('}')){
        currentLine++;
    }
    currentLine++;
    return clazz;
}

function isClass(lines, currentLine){
    const parts = lines[currentLine].split(' ');
    if(parts.include('class') || parts.include('abstract') || parts.include('interface') || parts.include('enum')){
        return true;
    }else{
        return false;
    }
}

function isPackage(lines, currentLine){
    const parts = lines[currentLine].split(' ');
    if(parts.include('package')){
        return true;
    }else{
        return false;
    }
}