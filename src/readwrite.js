const vscode = require('vscode');

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
}

class Field {
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }
}

class Method {
    constructor(name, returnType, parameters) {
        this.name = name;
        this.returnType = returnType;
        this.parameters = parameters || [];
    }
}
