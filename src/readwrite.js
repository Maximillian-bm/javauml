const fs = require('fs');
const path = require('path');
const { parse } = require('java-parser');

class Project {
    constructor(packages, classes) {
        this.packages = packages || [];
        this.classes = classes || [];
        this.listOfClassNames = [];
    }
    addPackage(pkg) {
        this.packages.push(pkg);
    }
    addClass(clazz) {
        this.classes.push(clazz);
    }
    toUML() {
        const uml = [];
        var depth = 0;
        uml.push('@startuml');
        for (const pkg of this.packages) {
            pkg.toUML(uml, depth);
        }
        for (const clazz of this.classes) {
            clazz.toUML(uml, depth);
        }
        for (const clazz of this.classes) {
            this.addContainArrows(uml, clazz);
        }
        for (const pkg of this.packages) {
            this.addContainArrowsFromPackages(uml, pkg);
        }
        uml.push('@enduml');
        return uml;
    }
    addContainArrows(uml, clazz) {
        for (const containes of clazz.containedClasses) {
            if (this.listOfClassNames.includes(containes)) {
                uml.push(`  ${clazz.name} o-- ${containes}: contains`);
            }
        }
    }
    addContainArrowsFromPackages(uml, pkg) {
        for (const clazz of pkg.classes) {
            this.addContainArrows(uml, clazz);
        }
        for (const subPackage of pkg.containedPackages) {
            this.addContainArrowsFromPackages(uml, subPackage);
        }
    }
}

class dict {
    constructor() {
        this.data = {};
    }
    add(key) {
        if (!this.data[key]) {
            this.data[key] = 0;
        }else {
            this.data[key]++;
        }
    }
    get(key) {
        return this.data[key] || 0;
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
    toUML(uml, depth) {
        const indent = ' '.repeat(depth * 2);
        uml.push(`${indent}package "${this.name}" {`);
        for (const clazz of this.classes) {
            clazz.toUML(uml, depth + 1);
        }
        for (const pkg of this.containedPackages) {
            pkg.toUML(uml, depth + 1);
        }
        uml.push(`${indent}}`);
    }
}

class Class {
    constructor(name, methods, fields, superclass, implementedInterfaces, containedClasses, isAbstract = false, isInterface = false, isEnum = false) {
        this.name = name;
        this.methods = methods || [];
        this.fields = fields || [];
        this.superclass = superclass || null;
        this.implementedInterfaces = implementedInterfaces || [];
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

    toUML(uml, depth) {
        const indent = ' '.repeat(depth * 2);
        var type = 'class ';
        if (this.isAbstract) {
            type = 'abstract ';
        }else if (this.isInterface) {
            type = 'interface ';
        }else if (this.isEnum) {
            type = 'enum ';
        }
        let classDef = `${indent}${type}${this.name}`;
        if (this.superclass) {
            classDef += ` extends ${this.superclass}`;
        }
        if (this.implementedInterfaces.length > 0) {
            classDef += ` implements ${this.implementedInterfaces.join(', ')}`;
        }
        uml.push(`${indent}${classDef} {`);
        const innerIndent = ' '.repeat((depth + 1) * 2);
        for (const field of this.fields) {
            const visibility = field.isPrivate ? '-' : '+';
            uml.push(`${innerIndent}  ${visibility} ${field.name}: ${field.type}`);
        }
        for (const method of this.methods) {
            const visibility = method.isPrivate ? '-' : '+';
            const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
            uml.push(`${innerIndent}  ${visibility} ${method.name}(${params}): ${method.returnType}`);
        }
        uml.push(`${indent}}`);
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
    const project = readProject(sourceFolder);
    const listOfClassNames = project.classes.map(clazz => clazz.name);
    for (const packageObj of project.packages) {
        findClassNames(listOfClassNames, packageObj);
    }
    for (const classObj of project.classes) {
        addContainedClass(listOfClassNames, classObj);
    }
    for (const packageObj of project.packages) {
        addContainedClassOfPackages(listOfClassNames, packageObj);
    }
    project.listOfClassNames = listOfClassNames;
    return project;
}

function addContainedClassOfPackages(listOfClassNames, packageObj) {
    for (const clazz of packageObj.classes) {
        addContainedClass(listOfClassNames, clazz);
    }
    for (const subPackage of packageObj.containedPackages) {
        addContainedClassOfPackages(listOfClassNames, subPackage);
    }
    return listOfClassNames;    
}

function findClassNames(listOfClassNames, packageObj) {
    for (const clazz of packageObj.classes) {
        listOfClassNames.push(clazz.name);
    }
    for (const subPackage of packageObj.containedPackages) {
        findClassNames(listOfClassNames, subPackage);
    }
    return listOfClassNames;    
}

function addContainedClass(listOfClassNames, classObj) {
    for (const field of classObj.fields) {
        if (listOfClassNames.includes(field.type)) {
            classObj.containedClasses.push(field.type);
        }
    }
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
        let isEnum = false;
        let isInterface = false;
        let isAbstract = false;
        let name = 'Unknown';
        let classDecl = null;
        // Check for enum
        if (typeDecl.children && typeDecl.children.enumDeclaration) {
            isEnum = true;
            classDecl = typeDecl.children.enumDeclaration[0];
            // Enum name
            if (classDecl.children.Identifier) {
                name = classDecl.children.Identifier[0].image;
            }
        } else if (typeDecl.children && typeDecl.children.interfaceDeclaration) {
            isInterface = true;
            classDecl = typeDecl.children.interfaceDeclaration[0];
            // Interface name
            if (classDecl.children.normalInterfaceDeclaration && classDecl.children.normalInterfaceDeclaration[0].children.typeIdentifier) {
                name = classDecl.children.normalInterfaceDeclaration[0].children.typeIdentifier[0].children.Identifier[0].image;
            }
        } else if (typeDecl.children && typeDecl.children.classDeclaration) {
            classDecl = typeDecl.children.classDeclaration[0];
            // Abstract class detection
            if (classDecl.children.classModifier) {
                for (const modifier of classDecl.children.classModifier) {
                    if (modifier.children && modifier.children.Abstract) {
                        isAbstract = true;
                        break;
                    }
                }
            }
            // Class name
            if (
                classDecl.children.normalClassDeclaration &&
                classDecl.children.normalClassDeclaration[0].children.typeIdentifier &&
                classDecl.children.normalClassDeclaration[0].children.typeIdentifier[0].children.Identifier
            ) {
                name = classDecl.children.normalClassDeclaration[0].children.typeIdentifier[0].children.Identifier[0].image;
            }
        } else {
            continue;
        }
        let superclass = null;
        let implementedInterfaces = [];
        // Only for normal classes (not enums/interfaces)
        if (!isEnum && !isInterface && classDecl.children.normalClassDeclaration) {
            const normalClass = classDecl.children.normalClassDeclaration[0];
            // Superclass (support both 'superclass' and 'classExtends' CST shapes)
            if (normalClass.children.classExtends && normalClass.children.classExtends[0].children.classType) {
                const classTypeNode = normalClass.children.classExtends[0].children.classType[0];
                if (classTypeNode.children.Identifier) {
                    const idents = classTypeNode.children.Identifier.map(id => id.image);
                    superclass = idents.join('.') || null;
                }
            } else if (normalClass.children.superclass) {
                const superNode = normalClass.children.superclass[0];
                if (superNode.children.classType && superNode.children.classType[0].children.Identifier) {
                    const idents = superNode.children.classType[0].children.Identifier.map(id => id.image);
                    superclass = idents.join('.') || null;
                }
            }
            // Implemented interfaces (support both 'classImplements' and 'superinterfaces' CST shapes)
            if (normalClass.children.classImplements && normalClass.children.classImplements[0].children.interfaceTypeList) {
                const interfaceList = normalClass.children.classImplements[0].children.interfaceTypeList[0];
                if (interfaceList.children.interfaceType) {
                    for (const iface of interfaceList.children.interfaceType) {
                        if (iface.children.classType && iface.children.classType[0].children.Identifier) {
                            const idents = iface.children.classType[0].children.Identifier.map(id => id.image);
                            implementedInterfaces.push(idents.join('.'));
                        }
                    }
                }
            } else if (normalClass.children.superinterfaces) {
                const superinterfacesNode = normalClass.children.superinterfaces[0];
                if (superinterfacesNode.children.interfaceTypeList) {
                    const interfaceList = superinterfacesNode.children.interfaceTypeList[0];
                    if (interfaceList.children.interfaceType) {
                        for (const iface of interfaceList.children.interfaceType) {
                            if (iface.children.classType && iface.children.classType[0].children.Identifier) {
                                const idents = iface.children.classType[0].children.Identifier.map(id => id.image);
                                implementedInterfaces.push(idents.join('.'));
                            }
                        }
                    }
                }
            }
        }
        const clazz = new Class(name, [], [], superclass, implementedInterfaces, [], isAbstract, isInterface, isEnum);
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
                        // Check for private modifier (robust)
                        let isPrivate = false;
                        if (methodDecl.children.methodModifier) {
                            for (const modifier of methodDecl.children.methodModifier) {
                                // Each modifier may have multiple children (e.g., Private, Static, etc.)
                                if (modifier.children && modifier.children.Private) {
                                    isPrivate = true;
                                    break;
                                }
                            }
                        }
                        // Use the parameter class for method parameters
                        let parameters = [];
                        if (methodHeader.children.methodDeclarator[0].children.formalParameterList) {
                            const paramList = methodHeader.children.methodDeclarator[0].children.formalParameterList[0];
                            // Only handle formalParameter (not varargs for now)
                            if (paramList.children.formalParameter) {
                                for (const param of paramList.children.formalParameter) {
                                    // Most common case: variableParaRegularParameter
                                    if (param.children.variableParaRegularParameter) {
                                        const regParam = param.children.variableParaRegularParameter[0];
                                        let paramType = 'Object';
                                        if (regParam.children.unannType && regParam.children.unannType[0]) {
                                            paramType = findTypeImage(regParam.children.unannType[0]) || 'Object';
                                        }
                                        let paramName = 'unknown';
                                        if (regParam.children.variableDeclaratorId && regParam.children.variableDeclaratorId[0].children.Identifier) {
                                            paramName = regParam.children.variableDeclaratorId[0].children.Identifier[0].image;
                                        }
                                        parameters.push(new parameter(paramName, paramType));
                                    } else if (param.children.unannType && param.children.variableDeclaratorId) {
                                        // Fallback for other parameter shapes
                                        let paramType = findTypeImage(param.children.unannType[0]) || 'Object';
                                        let paramName = 'unknown';
                                        if (param.children.variableDeclaratorId[0].children.Identifier) {
                                            paramName = param.children.variableDeclaratorId[0].children.Identifier[0].image;
                                        }
                                        parameters.push(new parameter(paramName, paramType));
                                    }
                                }
                            }
                            // TODO: handle varargs (lastFormalParameter) if needed
                        }
                        clazz.addMethod(new Method(methodName, returnType, parameters, isPrivate));
                    }
                }
            }
        }
        classes.push(clazz);
    }
    return classes;
}

function writeUMLToFile(uml, outputLocation){
    if (!fs.existsSync(outputLocation)) {
        fs.mkdirSync(outputLocation, { recursive: true });
    }
    const filePath = path.join(outputLocation, 'diagram.puml');
    fs.writeFileSync(filePath, uml.join('\n'), 'utf8');
    console.log(`UML diagram written to ${filePath}`);
}

module.exports = {
    readSourceFolder,
    writeUMLToFile
};
