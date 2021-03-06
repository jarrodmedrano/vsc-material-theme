import {extensions, workspace, window, Uri} from 'vscode';
import {posix} from 'path';
import {CONFIG_FILE_NAME, USER_CONFIG_FILE_NAME, MATERIAL_THEME_EXT_ID} from '../env';

type MaterialThemeConfig = {
  accents: Record<string, string>;
  accentsProperties: Record<string, {alpha: number; value: null }>;
  changelog?: { lastversion?: string };
};

type InstallationType = {
  firstInstall: boolean;
  update: boolean;
};

export interface IExtensionManager {
  getPackageJSON: () => Record<string, any>;
  getConfig: () => MaterialThemeConfig;
  getInstallationType: () => {};
  updateConfig: (config: Partial<MaterialThemeConfig>) => Promise<void>;
}

class ExtensionManager implements IExtensionManager {
  installationType: InstallationType;
  private readonly configFileUri: Uri;
  private readonly userConfigFileUri: Uri;
  private configJSON: MaterialThemeConfig;

  constructor() {
    const extensionFolderUri = Uri.file(extensions.getExtension(MATERIAL_THEME_EXT_ID).extensionPath);
    this.configFileUri = extensionFolderUri.with({path: posix.join(extensionFolderUri.path, CONFIG_FILE_NAME)});
    this.userConfigFileUri = extensionFolderUri.with({path: posix.join(extensionFolderUri.path, USER_CONFIG_FILE_NAME)});
    this.init();
  }

  getPackageJSON(): Record<string, any> {
    return extensions.getExtension(MATERIAL_THEME_EXT_ID).packageJSON;
  }

  getConfig(): MaterialThemeConfig {
    return this.configJSON;
  }

  getInstallationType(): InstallationType {
    return this.installationType;
  }

  async updateConfig(config: Partial<MaterialThemeConfig>): Promise<void> {
    const newConfig = {...this.configJSON, ...config};
    await workspace.fs.writeFile(this.configFileUri, Buffer.from(JSON.stringify(newConfig), 'utf-8'));
  }

  private isVersionUpdate(userConfig: MaterialThemeConfig): boolean {
    const splitVersion = (input: string): {major: number; minor: number; patch: number} => {
      const [major, minor, patch] = input.split('.').map(i => parseInt(i, 10));
      return {major, minor, patch};
    };

    const packageJSON = this.getPackageJSON();

    const versionCurrent = splitVersion(packageJSON.version);
    const versionOld = splitVersion(userConfig.changelog.lastversion);

    const update = (
      versionCurrent.major > versionOld.major ||
      versionCurrent.minor > versionOld.minor ||
      versionCurrent.patch > versionOld.patch
    );

    return update;
  }

  private async getUserConfig(): Promise<MaterialThemeConfig | undefined> {
    try {
      const configBuffer = await workspace.fs.readFile(this.userConfigFileUri);
      const configContent = Buffer.from(configBuffer).toString('utf8');
      return JSON.parse(configContent) as MaterialThemeConfig;
    } catch {}
  }

  private async init(): Promise<void> {
    try {
      const userConfig = await this.getUserConfig();
      this.installationType = {
        update: userConfig && this.isVersionUpdate(userConfig),
        firstInstall: !userConfig
      };

      const configBuffer = await workspace.fs.readFile(this.configFileUri);
      const configContent = Buffer.from(configBuffer).toString('utf8');

      await workspace.fs.writeFile(this.userConfigFileUri, configBuffer);

      this.configJSON = JSON.parse(configContent) as MaterialThemeConfig;
    } catch (error) {
      this.configJSON = {accentsProperties: {}, accents: {}};
      window
        .showErrorMessage(`Material Theme: there was an error while loading the configuration. Please retry or open an issue: ${String(error)}`);
    }
  }
}

export const extensionManager = new ExtensionManager();
