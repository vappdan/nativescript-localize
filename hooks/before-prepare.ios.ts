import * as fs from "fs";
import * as path from "path";
import * as plist from "simple-plist";

import { BeforePrepareCommon, I18nEntry, SupportedLanguages } from "./before-prepare.common";

import { encodeKey, encodeValue } from "../src/resource.ios";

export class BeforePrepareIOS extends BeforePrepareCommon {
  protected cleanObsoleteResourcesFiles(resourcesDirectory: string, supportedLanguages: SupportedLanguages): this {
    fs.readdirSync(resourcesDirectory).filter(fileName => {
      const match = /^(.+)\.lproj$/.exec(fileName);
      return match && !supportedLanguages.has(match[1]);
    }).map(fileName => {
      return path.join(resourcesDirectory, fileName);
    }).filter(filePath => {
      return fs.statSync(filePath).isDirectory();
    }).forEach(lngResourcesDir => {
      ["InfoPlist.strings", "Localizable.strings"].forEach(fileName => {
        const resourceFilePath = path.join(lngResourcesDir, fileName);
        this.removeFileIfExists(resourceFilePath);
      });
      this.removeDirectoryIfEmpty(lngResourcesDir);
    });
    return this;
  }

  protected createLanguageResourcesFiles(
    language: string,
    isDefaultLanguage: boolean,
    i18nContentIterator: Iterable<I18nEntry>
  ): this {
    const localizableStrings: I18nEntry[] = [];
    const infoPlistStrings: I18nEntry[] = [];
    for (const { key, value } of i18nContentIterator) {
      localizableStrings.push({ key, value });
      if (key === "app.name") {
        infoPlistStrings.push({ key: "CFBundleDisplayName", value });
        infoPlistStrings.push({ key: "CFBundleName", value });
      } else if (key.startsWith("ios.info.plist.")) {
        infoPlistStrings.push({ key: key.substr(15), value });
      }
    }
    const languageResourcesDir = path.join(this.appResourcesDirectoryPath, `${language}.lproj`);
    this
      .createDirectoryIfNeeded(languageResourcesDir)
      .writeStrings(languageResourcesDir, "Localizable.strings", localizableStrings, true)
      .writeStrings(languageResourcesDir, "InfoPlist.strings", infoPlistStrings, false)
    ;
    if (isDefaultLanguage) {
      infoPlistStrings.push({ key: "CFBundleDevelopmentRegion", value: language });
      this.writeInfoPlist(infoPlistStrings);
    }
    return this;
  }

  private writeStrings(languageResourcesDir: string, resourceFileName: string, strings: I18nEntry[], encodeKeys: boolean): this {
    let content = "";
    for (const { key, value } of strings) {
      content += `"${encodeKeys ? encodeKey(key) : key}" = "${encodeValue(value)}";\n`;
    }
    const resourceFilePath = path.join(languageResourcesDir, resourceFileName);
    this.writeFileSyncIfNeeded(resourceFilePath, content);
    return this;
  }

  private writeInfoPlist(infoPlistValues: I18nEntry[]) {
    const resourceFilePath = path.join(this.appResourcesDirectoryPath, "Info.plist");
    if (!fs.existsSync(resourceFilePath)) {
      this.logger.warn(`'${resourceFilePath}' doesn't exists: unable to set default language`);
      return this;
    }
    const data = plist.readFileSync(resourceFilePath);
    let resourceChanged = false;
    for (const { key, value } of infoPlistValues) {
      if (!data.hasOwnProperty(key) || data[key] !== value) {
        data[key] = value;
        resourceChanged = true;
      }
    }
    if (resourceChanged) {
      plist.writeFileSync(resourceFilePath, data);
    }
  }
}
