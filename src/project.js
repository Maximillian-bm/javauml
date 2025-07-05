
//just something to help out
class dict {
    constructor() {
        this.data = {};
        this.itterbleList = [];
    }
    add(key) {
        if (!this.itterbleList.includes(key)) {
            this.data[key] = 1;
            this.itterbleList.push(key);
        }else {
            this.data[key]++;
        }
    }
    get(key) {
        return this.data[key] || 0;
    }
    getAll() {
        return this.itterbleList;
    }
}

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
        const dictOfContainedClasses = new dict();
        for (const containes of clazz.containedClasses) {
            if (this.listOfClassNames.includes(containes)) {
                dictOfContainedClasses.add(containes);
            }
        }
        for (const containedClass of dictOfContainedClasses.getAll()) {
            if (dictOfContainedClasses.get(containedClass) == 1) {
                uml.push(`  ${clazz.name} o-- ${containedClass}: contains`);
            }else if (dictOfContainedClasses.get(containedClass) > 1) {
                uml.push(`  ${clazz.name} "1" o-- "many" ${containedClass}: contains`);
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

    toJava(){
        const lines = [];
        var firstLine = 'public';
        if(this.isPrivate){
            firstLine = 'private';
        }

        if(this.isAbstract){
            firstLine += ' abstract';
        }

        if(this.isInterface){
            firstLine += ' interface ';
        }else if(this.isEnum){
            firstLine += ' enum ';
        }else{
            firstLine += ' class ';
        }

        firstLine += this.name;

        if(this.superclass != null){
            firstLine += ' extends ' + this.superclass;
        }

        if(this.implementedInterfaces.length != 0){
            firstLine += ' implements ' + this.implementedInterfaces[0];
            for(const impl of this.implementedInterfaces){
                if(impl.valueOf() != this.implementedInterfaces[0].valueOf()){
                    firstLine += ', ' + impl;
                }
            }
        }

        firstLine += ' {';

        lines.push(firstLine);

        for(const field of this.fields){
            field.toJava(lines);
        }

        //TOD: methods

        const lastLine = '}';

        lines.push(lastLine);

        return lines;
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
    toJava(lines){
        var line = '    public ';
        if(this.isPrivate){
            line = '    private ';
        }
        line += this.type + ' ' + this.name + ';';
        lines.push(line);
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

class Parameter {
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }
}

module.exports = {
    Project,
    Package,
    Class,
    Field,
    Method,
    Parameter
};