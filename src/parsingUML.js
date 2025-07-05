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
    const line = lines[currentLine[0]].trim().split(' ');
    var temp = line[1];
    temp = temp.replace('"', '');
    temp = temp.replace('"', '');
    const name = temp;
    const packageBody = readClassesAndPackages(lines, currentLine);
    return new projectClasses.Package(name, packageBody[1], packageBody[0]);
}

function createClass(lines, currentLine){
    const line = lines[currentLine[0]].trim();
    //regex to match class/interface/enum/abstract definitions
    const classRegex = /^(abstract\s+)?(class|interface|enum)?\s*([A-Za-z0-9_]+)?(?:\s+extends\s+([A-Za-z0-9_]+))?(?:\s+implements\s+([A-Za-z0-9_,\s]+))?\s*\{/;
    const match = line.match(classRegex);

    let name = null;
    let isAbstract = false;
    let isInterface = false;
    let isEnum = false;
    let superclass = null;
    let implementedInterfaces = [];

    if (match) {
        isAbstract = !!match[1];
        const type = match[2];
        if (type === 'interface') isInterface = true;
        if (type === 'enum') isEnum = true;
        name = match[3] || null;
        superclass = match[4] || null;
        if (match[5]) {
            implementedInterfaces = match[5].split(',').map(s => s.trim()).filter(Boolean);
        }
    }

    const clazz = new projectClasses.Class(name, [], [], superclass, implementedInterfaces, [], isAbstract, isInterface, isEnum);
    currentLine[0]++;
    while(!lines[currentLine[0]].includes('}')){
        const bodyLine = lines[currentLine[0]].trim();
        if(isField(bodyLine)){
            const fieldRegex = /^([+-])?\s*([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_<>]+)$/;
            const match = bodyLine.match(fieldRegex);
            if (match) {
                const name = match[2];
                const type = match[3];
                const isPrivate = match[1] === '-' ? true : false;
                const field = new projectClasses.Field(name, type, isPrivate);
                clazz.addField(field);
            }
        }else if(isMethod(bodyLine)){
            const methodRegex = /^([+-])?\s*([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*:\s*([A-Za-z0-9_<>]+)$/;
            const match = bodyLine.match(methodRegex);
            if (match) {
                const name = match[2];
                const returnType = match[4];
                const isPrivate = match[1] === '-' ? true : false;
                const paramsString = match[3].trim();
                let parameters = [];
                if (paramsString.length > 0) {
                    parameters = paramsString.split(',').map(param => {
                        const paramMatch = param.trim().match(/^([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_<>]+)$/);
                        if (paramMatch) {
                            return new projectClasses.Parameter(paramMatch[1], paramMatch[2]);
                        }
                        return null;
                    }).filter(Boolean);
                }
                const method = new projectClasses.Method(name, returnType, parameters, isPrivate);
                clazz.addMethod(method);
            }
        }
        currentLine[0]++;
    }
    currentLine[0]++;
    return clazz;
}

function isField(line){
    return /^([+-])?\s*[A-Za-z0-9_]+\s*:\s*[A-Za-z0-9_<>]+$/.test(line);
}

function isMethod(line){
    return /^([+-])?\s*[A-Za-z0-9_]+\s*\([^)]*\)\s*:\s*[A-Za-z0-9_<>]+$/.test(line);
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

function writeProjectToJava(project, srcFolder){
    for(const pkg of project.packages){
        writePackageToJava(pkg, srcFolder);
    }
    for(const clazz of project.classes){
        writeClassToJava(clazz, srcFolder)
    }
}

function writePackageToJava(pkg, currentPath){

    const innerPath = path.join(currentPath, pkg.name);

    if (!fs.existsSync(innerPath)) {
        fs.mkdirSync(innerPath, { recursive: true });
    }

    for(const pkg of pkg.containedPackages){
        writePackageToJava(pkg, innerPath);
    }
    for(const clazz of pkg.classes){
        writeClassToJava(clazz, innerPath)
    }
}

function writeClassToJava(clazz, currentPath){

    const fileName = clazz.name + '.java';

    const javaFile = path.join(currentPath, fileName);

    fs.writeFileSync(javaFile, clazz.toJava.join('\n'), 'utf8');
}

module.exports = {
    readUMLfile,
    writeProjectToJava
};