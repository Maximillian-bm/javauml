const vscode = require('vscode');

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
    const fs = require('fs');
    const path = require('path');
    const { parse } = require('java-parser');

    if (!fs.existsSync(sourceFolder)) {
        throw new Error(`Source folder does not exist: ${sourceFolder}`);
    }

    const project = new Project();

    // Helper to recursively find all .java files
    function findJavaFiles(dir, files = []) {
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                findJavaFiles(fullPath, files);
            } else if (file.endsWith('.java')) {
                files.push(fullPath);
            }
        });
        return files;
    }

    // Helper to extract class info from CST
    function extractClasses(cst) {
        const classes = [];
        if (!cst.types) return classes;
        for (const type of cst.types) {
            if (type.node === 'normalClassDeclaration' || type.node === 'normalInterfaceDeclaration' || type.node === 'enumDeclaration') {
                const name = type.name.identifier;
                const isInterface = type.node === 'normalInterfaceDeclaration';
                const isEnum = type.node === 'enumDeclaration';
                const isAbstract = !!type.modifiers && type.modifiers.some(m => m.children.abstract);
                const superclass = type.extends && type.extends.length > 0 ? type.extends[0].typeType.classOrInterfaceType.identifier : null;
                const clazz = new Class(name, [], [], superclass, [], isAbstract, isInterface, isEnum);

                // Fields
                if (type.bodyDeclarations) {
                    for (const decl of type.bodyDeclarations) {
                        if (decl.node === 'fieldDeclaration') {
                            const fieldType = decl.type ? decl.type.node : 'Object';
                            for (const varDecl of decl.variableDeclarators) {
                                const fieldName = varDecl.variableDeclaratorId.identifier;
                                clazz.addField(new Field(fieldName, fieldType));
                            }
                        }
                        // Methods
                        if (decl.node === 'methodDeclaration') {
                            const methodName = decl.methodHeader.methodDeclarator.identifier;
                            const returnType = decl.methodHeader.result.node || 'void';
                            clazz.addMethod(new Method(methodName, returnType));
                        }
                    }
                }
                classes.push(clazz);
            }
        }
        return classes;
    }

    // Process each Java file
    const javaFiles = findJavaFiles(sourceFolder);
    javaFiles.forEach(filePath => {
        const code = fs.readFileSync(filePath, 'utf8');
        try {
            const cst = parse(code);
            const classes = extractClasses(cst);
            classes.forEach(clazz => project.addClass(clazz));
        } catch (e) {
            // Ignore parse errors for now
        }
    });

    return project;
}
