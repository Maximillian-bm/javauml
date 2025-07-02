interface UserSettings {
    sourceFolder: string;
    outputLocation: string;
}

interface ProjectSettings {
    [projectName: string]: UserSettings;
}

interface Settings {
    projects: ProjectSettings;
}