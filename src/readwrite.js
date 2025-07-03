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
            const packageClasses = getClassesInPath(fullPath);
            const packageObj = new Package(packageName, packageClasses);
            packages.push(packageObj);
        }
    }
    return packages;
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
    // Find the root node
    const root = cst.children.compilationUnit ? cst.children.compilationUnit[0] : cst;
    if (!root.children || !root.children.typeDeclaration) return classes;
    const typeDeclarations = root.children.typeDeclaration;
    for (const typeDecl of typeDeclarations) {
        if (!typeDecl.children || !typeDecl.children.classDeclaration) continue;
        for (const classDecl of typeDecl.children.classDeclaration) {
            const name = classDecl.children.Identifier ? classDecl.children.Identifier[0].image : 'Unknown';
            const clazz = new Class(name, [], []);
            // Find classBody
            if (classDecl.children.classBody && classDecl.children.classBody[0].children.classBodyDeclaration) {
                const bodyDecls = classDecl.children.classBody[0].children.classBodyDeclaration;
                for (const bodyDecl of bodyDecls) {
                    if (!bodyDecl.children) continue;
                    // Fields
                    if (bodyDecl.children.fieldDeclaration) {
                        for (const fieldDecl of bodyDecl.children.fieldDeclaration) {
                            // Type
                            let type = 'Object';
                            if (fieldDecl.children.unannType && fieldDecl.children.unannType[0].children) {
                                const typeNode = fieldDecl.children.unannType[0].children;
                                if (typeNode.unannClassOrInterfaceType) {
                                    type = typeNode.unannClassOrInterfaceType[0].children.Identifier[0].image;
                                } else if (typeNode.unannPrimitiveType) {
                                    type = typeNode.unannPrimitiveType[0].image;
                                }
                            }
                            // Variable declarators
                            if (fieldDecl.children.variableDeclaratorList) {
                                const varDecls = fieldDecl.children.variableDeclaratorList[0].children.variableDeclarator;
                                for (const varDecl of varDecls) {
                                    const fieldName = varDecl.children.variableDeclaratorId[0].children.Identifier[0].image;
                                    clazz.addField(new Field(fieldName, type));
                                }
                            }
                        }
                    }
                    // Methods
                    if (bodyDecl.children.methodDeclaration) {
                        for (const methodDecl of bodyDecl.children.methodDeclaration) {
                            const methodHeader = methodDecl.children.methodHeader[0];
                            const methodName = methodHeader.children.methodDeclarator[0].children.Identifier[0].image;
                            let returnType = 'void';
                            if (methodHeader.children.result && methodHeader.children.result[0].children.unannType) {
                                const typeNode = methodHeader.children.result[0].children.unannType[0].children;
                                if (typeNode.unannClassOrInterfaceType) {
                                    returnType = typeNode.unannClassOrInterfaceType[0].children.Identifier[0].image;
                                } else if (typeNode.unannPrimitiveType) {
                                    returnType = typeNode.unannPrimitiveType[0].image;
                                }
                            }
                            // Parameters
                            let parameters = [];
                            if (methodHeader.children.methodDeclarator[0].children.formalParameterList) {
                                const paramList = methodHeader.children.methodDeclarator[0].children.formalParameterList[0];
                                if (paramList.children.formalParameters) {
                                    for (const param of paramList.children.formalParameters[0].children.formalParameter) {
                                        const paramTypeNode = param.children.unannType[0].children;
                                        let paramType = 'Object';
                                        if (paramTypeNode.unannClassOrInterfaceType) {
                                            paramType = paramTypeNode.unannClassOrInterfaceType[0].children.Identifier[0].image;
                                        } else if (paramTypeNode.unannPrimitiveType) {
                                            paramType = paramTypeNode.unannPrimitiveType[0].image;
                                        }
                                        const paramName = param.children.variableDeclaratorId[0].children.Identifier[0].image;
                                        parameters.push({ name: paramName, type: paramType });
                                    }
                                }
                                if (paramList.children.lastFormalParameter) {
                                    // Handle varargs (optional)
                                }
                            }
                            clazz.addMethod(new Method(methodName, returnType, parameters));
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
