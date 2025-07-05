const fs = require('fs');
const path = require('path');
const { parse } = require('java-parser');
const projectClasses = require('./project')

//Converts Java to project object
function readSourceFolder(sourceFolder) {

    //init all objects
    const project = readProject(sourceFolder);

    //condenses packages to one package with the name Java/main/com/logic for example
    fixAllNestedPackages(project);

    const listOfClassNames = project.classes.map(clazz => clazz.name);
    for (const packageObj of project.packages) {
        findClassNames(listOfClassNames, packageObj);
    }

    //find any fields in classes that are objects of other classes
    for (const classObj of project.classes) {
        addContainedClass(listOfClassNames, classObj);
    }
    for (const packageObj of project.packages) {
        addContainedClassOfPackages(listOfClassNames, packageObj);
    }

    project.listOfClassNames = listOfClassNames;

    return project;
}

// Four recursive funtions to fix package names
function fixAllNestedPackages(project){
    for(const pkg of project.packages){
        fixNestedSubPackages(pkg);
    }
}

function fixNestedSubPackages(packageObj){
    removeNestedPackages(packageObj);
    for(const pkg of packageObj.containedPackages){
        removeNestedPackages(pkg);
    }
}

function removeNestedPackages(packageObj){
    var name = packageObj.name;
    const fixedPackage = recursiveNestedPackageFinder(name, packageObj);
    packageObj.name = fixedPackage.name;
    packageObj.classes = fixedPackage.classes;
    packageObj.containedPackages = fixedPackage.containedPackages;
}

function recursiveNestedPackageFinder(name, packageObj){
    if(packageObj.classes.length == 0 && packageObj.containedPackages.length == 1){
        const innerPackage = packageObj.containedPackages[0];
        name += '/' +innerPackage.name;
        return recursiveNestedPackageFinder(name, innerPackage);
    }else{
        return new projectClasses.Package(name, packageObj.classes, packageObj.containedPackages);
    }
}

//three funtions to find contained classes
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

//recursive functions to read project
function readProject(sourceFolder) {

    if (!fs.existsSync(sourceFolder)) {
        throw new Error(`Source folder does not exist: ${sourceFolder}`);
    }

    const project = new projectClasses.Project();

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
            const containedPackages = getPackagesInPath(fullPath);
            const packageObj = new projectClasses.Package(packageName, packageClasses, containedPackages);
            packages.push(packageObj);
        }
    }
    return packages;
}

//helper to recursively find the first .image property in a CST node
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


//tbh this funtion is an absolut mess... should prolly tighty it up at some point
//TODO: make ugly funtion pretty
function getClassesInFile(filePath) {
    const classes = [];
    const code = fs.readFileSync(filePath, 'utf8');
    let cst;
    try {
        cst = parse(code);
    } catch (e) {
        //if parse fails skip this file
        return classes;
    }
    //find the root node (handle both CST shapes)
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
        //check for enum
        if (typeDecl.children && typeDecl.children.enumDeclaration) {
            isEnum = true;
            classDecl = typeDecl.children.enumDeclaration[0];
            //enum name
            if (classDecl.children.Identifier) {
                name = classDecl.children.Identifier[0].image;
            }
        } else if (typeDecl.children && typeDecl.children.interfaceDeclaration) {
            isInterface = true;
            classDecl = typeDecl.children.interfaceDeclaration[0];
            //interface name
            if (classDecl.children.normalInterfaceDeclaration && classDecl.children.normalInterfaceDeclaration[0].children.typeIdentifier) {
                name = classDecl.children.normalInterfaceDeclaration[0].children.typeIdentifier[0].children.Identifier[0].image;
            }
        } else if (typeDecl.children && typeDecl.children.classDeclaration) {
            classDecl = typeDecl.children.classDeclaration[0];
            //abstract class detection
            if (classDecl.children.classModifier) {
                for (const modifier of classDecl.children.classModifier) {
                    if (modifier.children && modifier.children.Abstract) {
                        isAbstract = true;
                        break;
                    }
                }
            }
            //class name
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
        //only for normal classes (not enums/interfaces)
        if (!isEnum && !isInterface && classDecl.children.normalClassDeclaration) {
            const normalClass = classDecl.children.normalClassDeclaration[0];
            //superclass (support both 'superclass' and 'classExtends' CST shapes)
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
            //implemented interfaces (support both 'classImplements' and 'superinterfaces' CST shapes)
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
        const clazz = new projectClasses.Class(name, [], [], superclass, implementedInterfaces, [], isAbstract, isInterface, isEnum);
        //find classBody
        let classBody = null;
        if (
            classDecl.children.normalClassDeclaration &&
            classDecl.children.normalClassDeclaration[0].children.classBody
        ) {
            classBody = classDecl.children.normalClassDeclaration[0].children.classBody[0];
        }
        //handle interfaceBody for interfaces
        if (
            isInterface &&
            classDecl.children.normalInterfaceDeclaration &&
            classDecl.children.normalInterfaceDeclaration[0].children.interfaceBody
        ) {
            classBody = classDecl.children.normalInterfaceDeclaration[0].children.interfaceBody[0];
        }
        if (classBody && classBody.children.classBodyDeclaration) {
            const bodyDecls = classBody.children.classBodyDeclaration;
            for (const bodyDecl of bodyDecls) {
                if (!bodyDecl.children || !bodyDecl.children.classMemberDeclaration) continue;
                const memberDecl = bodyDecl.children.classMemberDeclaration[0];
                //fields
                if (memberDecl.children.fieldDeclaration) {
                    for (const fieldDecl of memberDecl.children.fieldDeclaration) {
                        //type
                        let type = 'Object';
                        if (fieldDecl.children.unannType && fieldDecl.children.unannType[0]) {
                            type = findTypeImage(fieldDecl.children.unannType[0]) || 'Object';
                        }
                        //check for private modifier
                        let isPrivate = false;
                        if (fieldDecl.children.fieldModifier) {
                            for (const modifier of fieldDecl.children.fieldModifier) {
                                if (modifier.children && modifier.children.Private) {
                                    isPrivate = true;
                                    break;
                                }
                            }
                        }
                        //variable declarators
                        if (fieldDecl.children.variableDeclaratorList) {
                            const varDecls = fieldDecl.children.variableDeclaratorList[0].children.variableDeclarator;
                            for (const varDecl of varDecls) {
                                const fieldName = varDecl.children.variableDeclaratorId[0].children.Identifier[0].image;
                                clazz.addField(new projectClasses.Field(fieldName, type, isPrivate));
                            }
                        }
                    }
                }
                //methods
                if (memberDecl.children.methodDeclaration) {
                    for (const methodDecl of memberDecl.children.methodDeclaration) {
                        const methodHeader = methodDecl.children.methodHeader[0];
                        const methodName = methodHeader.children.methodDeclarator[0].children.Identifier[0].image;
                        //return type
                        let returnType = 'void';
                        if (methodHeader.children.result && methodHeader.children.result[0].children.unannType) {
                            returnType = findTypeImage(methodHeader.children.result[0].children.unannType[0]) || 'void';
                        }
                        //check for private modifier (robust)
                        let isPrivate = false;
                        if (methodDecl.children.methodModifier) {
                            for (const modifier of methodDecl.children.methodModifier) {
                                //each modifier may have multiple children (e.g., Private, Static, etc.)
                                if (modifier.children && modifier.children.Private) {
                                    isPrivate = true;
                                    break;
                                }
                            }
                        }
                        //use the parameter class for method parameters
                        let parameters = [];
                        if (methodHeader.children.methodDeclarator[0].children.formalParameterList) {
                            const paramList = methodHeader.children.methodDeclarator[0].children.formalParameterList[0];
                            //only handle formalParameter (not varargs for now)
                            if (paramList.children.formalParameter) {
                                for (const param of paramList.children.formalParameter) {
                                    //most common case: variableParaRegularParameter
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
                                        parameters.push(new projectClasses.Parameter(paramName, paramType));
                                    } else if (param.children.unannType && param.children.variableDeclaratorId) {
                                        //fallback for other parameter shapes
                                        let paramType = findTypeImage(param.children.unannType[0]) || 'Object';
                                        let paramName = 'unknown';
                                        if (param.children.variableDeclaratorId[0].children.Identifier) {
                                            paramName = param.children.variableDeclaratorId[0].children.Identifier[0].image;
                                        }
                                        parameters.push(new projectClasses.Parameter(paramName, paramType));
                                    }
                                }
                            }
                        }
                        clazz.addMethod(new projectClasses.Method(methodName, returnType, parameters, isPrivate));
                    }
                }
            }
        }
        //handle interface methods
        if (isInterface && classBody && classBody.children.interfaceMemberDeclaration) {
            const memberDecls = classBody.children.interfaceMemberDeclaration;
            for (const memberDecl of memberDecls) {
                if (!memberDecl.children || !memberDecl.children.interfaceMethodDeclaration) continue;
                const methodDecl = memberDecl.children.interfaceMethodDeclaration[0];
                const methodHeader = methodDecl.children.methodHeader[0];
                const methodName = methodHeader.children.methodDeclarator[0].children.Identifier[0].image;
                //return type
                let returnType = 'void';
                if (methodHeader.children.result && methodHeader.children.result[0].children.unannType) {
                    returnType = findTypeImage(methodHeader.children.result[0].children.unannType[0]) || 'void';
                }
                //parameters
                let parameters = [];
                if (methodHeader.children.methodDeclarator[0].children.formalParameterList) {
                    const paramList = methodHeader.children.methodDeclarator[0].children.formalParameterList[0];
                    if (paramList.children.formalParameter) {
                        for (const param of paramList.children.formalParameter) {
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
                                parameters.push(new projectClasses.Parameter(paramName, paramType));
                            } else if (param.children.unannType && param.children.variableDeclaratorId) {
                                let paramType = findTypeImage(param.children.unannType[0]) || 'Object';
                                let paramName = 'unknown';
                                if (param.children.variableDeclaratorId[0].children.Identifier) {
                                    paramName = param.children.variableDeclaratorId[0].children.Identifier[0].image;
                                }
                                parameters.push(new projectClasses.Parameter(paramName, paramType));
                            }
                        }
                    }
                }
                //interfaces can't have private methods
                clazz.addMethod(new projectClasses.Method(methodName, returnType, parameters, false));
            }
        }
        classes.push(clazz);
    }
    return classes;
}

//uses the project toUML() to write plantUML
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
    writeUMLToFile,
    getClassesInFile
};