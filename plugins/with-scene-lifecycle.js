// iOS 27 stops an app at launch unless it adopts the UIScene life cycle. Expo SDK 57 ships the
// scene delegate (ExpoAppSceneDelegate) but its project template is still window-based, so a
// development or EAS build of Navo crashed on start. This plugin makes the generated project
// scene-based the way the SDK 58 template does (see Lova Driver's ios/): a SceneDelegate,
// the scene manifest in Info.plist, and an AppDelegate that leaves the window to the scene.
// Remove it after upgrading to SDK 58.
const fs = require("fs");
const path = require("path");
const { IOSConfig, withAppDelegate, withDangerousMod, withInfoPlist, withXcodeProject } = require("expo/config-plugins");

const SCENE_DELEGATE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

function replaceOnce(src, from, to, what) {
  if (src.includes(to)) return src;
  if (!src.includes(from)) throw new Error(`with-scene-lifecycle: AppDelegate.swift changed shape (${what}); update the plugin.`);
  return src.replace(from, to);
}

const withSceneLifecycle = (config) => {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: "Default Configuration", UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate" },
        ],
      },
    };
    return c;
  });

  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== "swift") throw new Error("with-scene-lifecycle: expected a Swift AppDelegate.");
    let src = c.modResults.contents;
    src = replaceOnce(src, "class AppDelegate: ExpoAppDelegate {", "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {", "class line");
    src = src.replace(
      /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/,
      "    // The window is created and React Native is started by SceneDelegate (scene life cycle, iOS 27).\n",
    );
    if (src.includes("UIWindow(frame: UIScreen.main.bounds)")) throw new Error("with-scene-lifecycle: could not remove the window start-up from AppDelegate.swift.");
    c.modResults.contents = src;
    return c;
  });

  config = withDangerousMod(config, ["ios", (c) => {
    const dir = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName);
    fs.writeFileSync(path.join(dir, "SceneDelegate.swift"), SCENE_DELEGATE);
    return c;
  }]);

  return withXcodeProject(config, (c) => {
    const project = c.modResults;
    const name = c.modRequest.projectName;
    const file = `${name}/SceneDelegate.swift`;
    if (!project.hasFile(file)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath: file, groupName: name, project });
    }
    return c;
  });
};

module.exports = withSceneLifecycle;
