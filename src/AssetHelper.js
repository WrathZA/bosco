
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var mime = require('mime');
var sf = require('sf');
var _ = require('lodash');

module.exports = function(bosco) {
  function checksum(str, algorithm, encoding) {
    return crypto
      .createHash(algorithm || 'md5')
      .update(str, 'utf8')
      .digest(encoding || 'hex');
  }

  function resolve(boscoRepo, basePath, asset, assetKey) {
    var resolvedPath = path.join(boscoRepo.path, basePath, asset);

    if (!fs.existsSync(resolvedPath)) {
      return bosco.warn(sf('Asset {asset} not found at path {path}, declared in {repo}', {
        asset: assetKey,
        path: resolvedPath,
        repo: boscoRepo.name,
      }));
    }

    return resolvedPath;
  }

  function getExtraFiles(repoPath, build) {
    var extraFiles = build && build.watch && build.watch.extraBrowserSyncFiles || [];
    return _.map(extraFiles, function(glob) {
      return path.join(repoPath, glob);
    });
  }

  function getAssetHelper(boscoRepo, tagFilter) {
    return {
      addAsset: function(staticAssets, buildNumber, assetKey, asset, tag, type, basePath, externalBuild, minificationConfig) {
        if (tagFilter && tag !== tagFilter) return;

        var newAsset = {};
        var resolvedPath = resolve(boscoRepo, basePath, asset, assetKey);

        if (resolvedPath) {
          newAsset.serviceName = boscoRepo.serviceName;
          newAsset.buildNumber = buildNumber;
          newAsset.mimeType = mime.lookup(asset);
          newAsset.assetKey = assetKey;
          newAsset.asset = asset;
          newAsset.externalBuild = externalBuild;
          newAsset.repoPath = boscoRepo.repoPath;
          newAsset.basePath = path.join(newAsset.repoPath, basePath);
          newAsset.relativePath = path.join('.', basePath || '', asset);
          newAsset.path = resolvedPath;
          newAsset.fileName = path.basename(asset);
          newAsset.extname = path.extname(asset);
          newAsset.bundleKey = boscoRepo.serviceName + '/' + tag;
          newAsset.tag = tag;
          newAsset.repo = boscoRepo.name;
          newAsset.type = type;
          newAsset.tagType = tag + '.' + type;
          newAsset.data = fs.readFileSync(newAsset.path);
          newAsset.content = newAsset.data.toString();
          newAsset.checksum = checksum(newAsset.content, 'sha1', 'hex');
          newAsset.uniqueKey = newAsset.bundleKey + ':' + assetKey;
          newAsset.extraBrowserSyncFiles = getExtraFiles(newAsset.repoPath, boscoRepo.build);
          newAsset.minificationConfig = minificationConfig;
          staticAssets.push(newAsset);
        }
      },
      addError: function(staticAssets, tag, message) {
        var newAsset = {};
        newAsset.serviceName = boscoRepo.serviceName;
        newAsset.assetKey = 'formattedAssets';
        newAsset.bundleKey = boscoRepo.serviceName + '/' + tag;
        newAsset.buildNumber = '';
        newAsset.tag = tag;
        newAsset.repo = boscoRepo.name;
        newAsset.type = 'error';
        newAsset.repoPath = boscoRepo.repoPath;
        newAsset.basePath = boscoRepo.repoPath;
        newAsset.relativePath = boscoRepo.repoPath;
        newAsset.path = boscoRepo.repoPath;
        newAsset.message = message;
        newAsset.content = '';
        staticAssets.push(newAsset);
      },
    };
  }

  function createKey(name, buildNumber, tag, hash, type, extension) {
    return path.join(name, buildNumber, type, tag + (hash ? '.' + hash : '') + (extension ? '.' + extension : ''));
  }


  return {
    getAssetHelper: getAssetHelper,
    createKey: createKey,
    checksum: checksum,
  };
};
