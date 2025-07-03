const fs = require('fs');
const path = require('path');
const { parse } = require('java-parser');

class Project {
    constructor(packages, classes) {
        this.packages = packages || [];
        this.classes = classes || [];
    }
    addPackage(pkg) {
        this.packages.push(pkg);
    }
    addClass(clazz) {
        this.classes.push(clazz);
    }
}

class Package {
    constructor(name, classes, containedPackages) {
        this.name = name;
        this.classes = classes || [];
        this.containedPackages = containedPackages || [];
    }
    addClass(clazz) {
        this.classes.push(clazz);
    }
    addPackage(pkg) {
        this.containedPackages.push(pkg);
    }
}

class Class {
    constructor(name, methods, fields, superclass, containedClasses, isAbstract = false, isInterface = false, isEnum = false) {
        this.name = name;
        this.methods = methods || [];
        this.fields = fields || [];
        this.superclass = superclass || null;
        this.containedClasses = containedClasses || [];
        this.isAbstract = isAbstract;
        this.isInterface = isInterface;
        this.isEnum = isEnum;
    }

    addMethod(method) {
        this.methods.push(method);
    }

    addField(field) {
        this.fields.push(field);
    }

    addContainedClass(clazz) {
        this.containedClasses.push(clazz);
    }
}

class Field {
    constructor(name, type, isPrivate = false) {
        this.name = name;
        this.type = type;
        this.isPrivate = isPrivate;
    }
}

class Method {
    constructor(name, returnType, parameters, isPrivate = false) {
        this.name = name;
        this.returnType = returnType;
        this.parameters = parameters || [];
        this.isPrivate = isPrivate;
    }
}

class parameter {
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }
}

function readSourceFolder(sourceFolder) {
    return readProject(sourceFolder);
}

function readProject(sourceFolder) {

    if (!fs.existsSync(sourceFolder)) {
        throw new Error(`Source folder does not exist: ${sourceFolder}`);
    }

    const project = new Project();

    const classes = getClassesInPath(sourceFolder);

    for (const clazz of classes) {
        project.addClass(clazz);
    }

    const packages = getPackagesInPath(sourceFolder);

    for (const pkg of packages) {
        project.addPackage(pkg);
    }

    return project;

}

function getClassesInPath(currentPath) {
    const classes = [];
    for (const file of fs.readdirSync(currentPath)) {
        if (file.endsWith('.java')){
            const filePath = path.join(currentPath, file);
            const fileClasses = getClassesInFile(filePath);
            classes.push(...fileClasses);
        }
    }
    return classes;
}

function getPackagesInPath(currentPath) {
    const packages = [];
    const files = fs.readdirSync(currentPath);
    for (const name of files) {
        const fullPath = path.join(currentPath, name);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            const packageName = path.basename(fullPath);
            // Collect classes in this directory
            const packageClasses = getClassesInPath(fullPath);
            // Recursively collect contained packages
            const containedPackages = getPackagesInPath(fullPath);
            // Create the package with its classes and contained packages
            const packageObj = new Package(packageName, packageClasses, containedPackages);
            packages.push(packageObj);
        }
    }
    return packages;
}

// Helper to recursively find the first .image property in a CST node
function findTypeImage(node) {
    if (!node) return null;
    if (Array.isArray(node)) {
        for (const n of node) {
            const result = findTypeImage(n);
            if (result) return result;
        }
    } else if (typeof node === 'object') {
        if (node.image) return node.image;
        if (node.children) {
            for (const key of Object.keys(node.children)) {
                const result = findTypeImage(node.children[key]);
                if (result) return result;
            }
        }
    }
    return null;
}

function getClassesInFile(filePath) {
    const classes = [];
    const code = fs.readFileSync(filePath, 'utf8');
    let cst;
    try {
        cst = parse(code);
    } catch (e) {
        // If parse fails, skip this file
        return classes;
    }
    // Find the root node (handle both CST shapes)
    let root = cst;
    if (root.name === 'compilationUnit' && root.children && root.children.ordinaryCompilationUnit) {
        root = root.children.ordinaryCompilationUnit[0];
    } else if (root.children && root.children.compilationUnit) {
        root = root.children.compilationUnit[0];
    }
    if (!root.children || !root.children.typeDeclaration) return classes;
    const typeDeclarations = root.children.typeDeclaration;
    for (const typeDecl of typeDeclarations) {
        if (!typeDecl.children || !typeDecl.children.classDeclaration) continue;
        for (const classDecl of typeDecl.children.classDeclaration) {
            // Extract class name from typeIdentifier
            let name = 'Unknown';
            if (
                classDecl.children.normalClassDeclaration &&
                classDecl.children.normalClassDeclaration[0].children.typeIdentifier &&
                classDecl.children.normalClassDeclaration[0].children.typeIdentifier[0].children.Identifier
            ) {
                name = classDecl.children.normalClassDeclaration[0].children.typeIdentifier[0].children.Identifier[0].image;
            }
            const clazz = new Class(name, [], []);
            // Find classBody
            let classBody = null;
            if (
                classDecl.children.normalClassDeclaration &&
                classDecl.children.normalClassDeclaration[0].children.classBody
            ) {
                classBody = classDecl.children.normalClassDeclaration[0].children.classBody[0];
            }
            if (classBody && classBody.children.classBodyDeclaration) {
                const bodyDecls = classBody.children.classBodyDeclaration;
                for (const bodyDecl of bodyDecls) {
                    if (!bodyDecl.children || !bodyDecl.children.classMemberDeclaration) continue;
                    const memberDecl = bodyDecl.children.classMemberDeclaration[0];
                    // Fields
                    if (memberDecl.children.fieldDeclaration) {
                        for (const fieldDecl of memberDecl.children.fieldDeclaration) {
                            // Type
                            let type = 'Object';
                            if (fieldDecl.children.unannType && fieldDecl.children.unannType[0]) {
                                type = findTypeImage(fieldDecl.children.unannType[0]) || 'Object';
                            }
                            // Check for private modifier
                            let isPrivate = false;
                            if (fieldDecl.children.fieldModifier) {
                                for (const modifier of fieldDecl.children.fieldModifier) {
                                    if (modifier.children && modifier.children.Private) {
                                        isPrivate = true;
                                        break;
                                    }
                                }
                            }
                            // Variable declarators
                            if (fieldDecl.children.variableDeclaratorList) {
                                const varDecls = fieldDecl.children.variableDeclaratorList[0].children.variableDeclarator;
                                for (const varDecl of varDecls) {
                                    const fieldName = varDecl.children.variableDeclaratorId[0].children.Identifier[0].image;
                                    clazz.addField(new Field(fieldName, type, isPrivate));
                                }
                            }
                        }
                    }
                    // Methods
                    if (memberDecl.children.methodDeclaration) {
                        for (const methodDecl of memberDecl.children.methodDeclaration) {
                            const methodHeader = methodDecl.children.methodHeader[0];
                            const methodName = methodHeader.children.methodDeclarator[0].children.Identifier[0].image;
                            // Return type
                            let returnType = 'void';
                            if (methodHeader.children.result && methodHeader.children.result[0].children.unannType) {
                                returnType = findTypeImage(methodHeader.children.result[0].children.unannType[0]) || 'void';
                            }
                            // Check for private modifier
                            let isPrivate = false;
                            if (methodDecl.children.methodModifier) {
                                for (const modifier of methodDecl.children.methodModifier) {
                                    if (modifier.children && modifier.children.Private) {
                                        isPrivate = true;
                                        break;
                                    }
                                }
                            }
                            // Parameters
                            let parameters = [];
                            if (methodHeader.children.methodDeclarator[0].children.formalParameterList) {
                                const paramList = methodHeader.children.methodDeclarator[0].children.formalParameterList[0];
                                if (paramList.children.formalParameters) {
                                    for (const param of paramList.children.formalParameters[0].children.formalParameter) {
                                        let paramType = findTypeImage(param.children.unannType[0]) || 'Object';
                                        const paramName = param.children.variableDeclaratorId[0].children.Identifier[0].image;
                                        parameters.push({ name: paramName, type: paramType });
                                    }
                                }
                                if (paramList.children.lastFormalParameter) {
                                    // Handle varargs (optional)
                                }
                            }
                            clazz.addMethod(new Method(methodName, returnType, parameters, isPrivate));
                        }
                    }
                }
            }
            classes.push(clazz);
        }
    }
    return classes;
}

module.exports = {
    readSourceFolder
};
