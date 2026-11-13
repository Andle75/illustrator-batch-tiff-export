#target illustrator

(function () {
    // AUTO uses the document color mode. ALL exports every artboard.
    var COLOR_MODE = "AUTO";  // AUTO / RGB / CMYK
    var ARTBOARDS = "ALL";    // ALL / ACTIVE

    // Each entry is [English, Simplified Chinese].
    var strings = {
        title: ["Illustrator Batch TIFF Export", "Illustrator 批量导出 TIFF"],
        folders: ["Folders", "文件夹"],
        source: ["Source folder", "源文件夹"],
        sourceHint: ["Select the folder containing .ai files", "选择包含 .ai 文件的文件夹"],
        output: ["Output folder", "输出文件夹"],
        outputHint: ["Default: TIFF subfolder of the source", "默认保存到源文件夹下的 TIFF"],
        outputPicker: ["Select the TIFF output folder", "选择 TIFF 输出文件夹"],
        scanHint: ["Scans the selected folder only.", "扫描所选文件夹这一层的 .ai 文件。"],
        fileCount: [".ai files found: {0}", "找到 {0} 个 .ai 文件。"],
        noFiles: ["This folder contains no .ai files.", "此文件夹中没有 .ai 文件。"],
        browse: ["Browse…", "选择…"],
        options: ["TIFF settings", "TIFF 设置"],
        resolution: ["Resolution", "分辨率"],
        custom: ["Custom", "自定义"],
        compression: ["Use LZW lossless compression", "使用 LZW 无损压缩"],
        cancel: ["Cancel", "取消"],
        start: ["Start export", "开始导出"],
        invalidResolution: ["Enter a resolution between 72 and 2400 ppi.", "请输入 72 到 2400 之间的分辨率。"],
        readSource: ["Cannot read the selected source folder.", "无法读取所选源文件夹。"],
        invalidOutput: ["Cannot use the output folder:\n{0}", "无法使用输出文件夹：\n{0}"],
        progress: ["Exporting TIFFs", "正在批量导出 TIFF"],
        preparing: ["Preparing to export…", "正在准备导出…"],
        artboard: [" · Artboard {0}", " · 画板 {0}"],
        partial: [" (TIFFs already exported: {0})", "（已导出 {0} 个 TIFF）"],
        fileError: ["{0}: {1}", "{0}：{1}"],
        stagingCleanup: ["Could not remove temporary folder: {0}", "临时文件夹清理失败：{0}"],
        documentClose: ["Could not close the document. {0}", "无法关闭文档。{0}"],
        missingTiff: ["Illustrator did not produce a recognizable TIFF file.", "Illustrator 未生成可识别的 TIFF 文件。"],
        incompleteTiff: ["Incomplete write. Check the file: {0}", "写入未完成，请检查文件：{0}"],
        writeTiff: ["Cannot write the file: {0}", "无法写入文件：{0}"],
        tempTiff: ["Cannot remove the temporary TIFF file.", "无法清理临时 TIFF 文件。"],
        createStaging: ["Cannot create a temporary folder in: {0}", "无法在此位置创建临时目录：{0}"],
        result: ["Batch TIFF Export Results", "TIFF 批量导出结果"],
        summary: ["AI files completed: {0}/{1}   |   TIFFs created: {2}", "已完成 {0} / {1} 个 AI 文件，生成 {2} 个 TIFF。"],
        issues: ["AI files with incomplete exports: {0}. See details below.", "未完成 {0} 个 AI 文件。处理详情如下："],
        done: ["Done", "完成"]
    };
    var language = defaultLanguage();

    var settings = showSettings();
    if (settings) {
        runBatch(settings);
    }

    function defaultLanguage() {
        var locale;
        try {
            locale = app.locale;
        } catch (localeError) {
            // ExtendScript provides a locale when the host does not.
        }
        if (!locale && typeof $ !== "undefined") {
            locale = $.locale;
        }
        return /^zh(?:[-_]|$)/i.test(String(locale || "")) ? 1 : 0;
    }

    function message(key) {
        var values = arguments;
        return strings[key][language].replace(/\{(\d+)\}/g, function (match, index) {
            return String(values[Number(index) + 1]);
        });
    }

    function showSettings() {
        var dialog = new Window("dialog", message("title"));
        dialog.alignChildren = "fill";
        dialog.spacing = 12;
        dialog.margins = 18;

        var languageRow = dialog.add("group");
        languageRow.add("statictext", undefined, "Language / 语言");
        var languageChoice = languageRow.add("dropdownlist", undefined, ["English", "简体中文"]);
        languageChoice.preferredSize.width = 110;
        languageChoice.selection = language;

        var locations = dialog.add("panel", undefined, message("folders"));
        locations.alignChildren = "fill";
        locations.margins = 14;
        var sourceRow = addFolderRow(locations, "source", "sourceHint");
        var outputRow = addFolderRow(locations, "output", "outputHint");
        outputRow.button.enabled = false;
        var fileCount = locations.add("statictext", undefined, message("scanHint"));
        fileCount.alignment = "fill";

        var options = dialog.add("panel", undefined, message("options"));
        options.alignChildren = "left";
        options.margins = 14;

        var resolutionRow = options.add("group");
        var resolutionLabel = resolutionRow.add("statictext", undefined, message("resolution"));
        var presetValues = ["72", "150", "300", "600", "1200", "2400"];
        var customIndex = presetValues.length;
        var presets = resolutionRow.add("dropdownlist", undefined, presetValues.concat([message("custom")]));
        presets.preferredSize.width = 100;
        presets.selection = 2;
        var custom = resolutionRow.add("edittext", undefined, "300");
        custom.characters = 6;
        custom.enabled = false;
        var customPpi = "300";
        resolutionRow.add("statictext", undefined, "ppi");
        presets.onChange = function () {
            if (custom.enabled) {
                customPpi = custom.text;
            }
            var index = presets.selection.index;
            var useCustom = index === customIndex;
            custom.enabled = useCustom;
            custom.text = useCustom ? customPpi : presetValues[index];
            if (useCustom) {
                custom.active = true;
            }
        };

        var compression = options.add("checkbox", undefined, message("compression"));
        compression.value = true;

        var buttons = dialog.add("group");
        buttons.alignment = "right";
        var cancel = buttons.add("button", undefined, message("cancel"), {name: "cancel"});
        var start = buttons.add("button", undefined, message("start"));
        dialog.defaultElement = start;
        start.enabled = false;

        var source;
        var selectedOutput;
        var settings;
        var count = null;
        var scanFailed = false;

        function refreshFileCount() {
            if (scanFailed) {
                fileCount.text = message("readSource");
            } else if (count === null) {
                fileCount.text = message("scanHint");
            } else {
                fileCount.text = count ? message("fileCount", count) : message("noFiles");
            }
        }

        languageChoice.onChange = function () {
            if (!languageChoice.selection) {
                return;
            }
            language = languageChoice.selection.index;
            dialog.text = message("title");
            locations.text = message("folders");
            sourceRow.label.text = message("source");
            outputRow.label.text = message("output");
            sourceRow.button.text = message("browse");
            outputRow.button.text = message("browse");
            if (!source) {
                sourceRow.field.text = message("sourceHint");
                outputRow.field.text = message("outputHint");
            }
            refreshFileCount();
            options.text = message("options");
            resolutionLabel.text = message("resolution");
            presets.items[customIndex].text = message("custom");
            compression.text = message("compression");
            cancel.text = message("cancel");
            start.text = message("start");
            dialog.layout.layout(true);
            dialog.layout.resize();
        };

        sourceRow.button.onClick = function () {
            var chosen = source
                ? source.selectDlg(message("sourceHint"))
                : Folder.selectDialog(message("sourceHint"));
            if (!chosen) {
                return;
            }
            source = chosen;
            sourceRow.field.text = source.fsName;
            outputRow.field.text = (selectedOutput || defaultOutput(source)).fsName;
            outputRow.button.enabled = true;
            scanFailed = false;
            try {
                count = listAiFiles(source).length;
            } catch (error) {
                scanFailed = true;
            }
            refreshFileCount();
            start.enabled = !scanFailed && count > 0;
        };

        outputRow.button.onClick = function () {
            var initial = selectedOutput || defaultOutput(source);
            if (!initial.exists) {
                initial = source;
            }
            var chosen = initial.selectDlg(message("outputPicker"));
            if (chosen) {
                selectedOutput = chosen;
                outputRow.field.text = chosen.fsName;
            }
        };

        start.onClick = function () {
            var selectedResolution = custom.enabled ? custom.text : presetValues[presets.selection.index];
            var text = selectedResolution.replace(/^\s+|\s+$/g, "");
            var ppi = Number(text);
            if (!/^\d+(\.\d+)?$/.test(text) || ppi < 72 || ppi > 2400) {
                alert(message("invalidResolution"));
                custom.active = true;
                return;
            }

            try {
                var files = listAiFiles(source);
                if (files.length === 0) {
                    alert(message("noFiles"));
                    return;
                }
                var output = selectedOutput || defaultOutput(source);
                if (!selectedOutput && !output.exists) {
                    output.create();
                }
                if (!output.exists) {
                    throw new Error(message("invalidOutput", output.fsName));
                }
                settings = {files: files, output: output, ppi: ppi, lzw: compression.value};
                dialog.close(1);
            } catch (error) {
                alert(errorText(error));
            }
        };

        return dialog.show() === 1 ? settings : null;
    }

    function addFolderRow(panel, label, placeholder) {
        var row = panel.add("group");
        var title = row.add("statictext", undefined, message(label));
        title.preferredSize.width = 100;
        var field = row.add("edittext", undefined, message(placeholder), {readonly: true});
        field.preferredSize.width = 330;
        return {label: title, field: field, button: row.add("button", undefined, message("browse"))};
    }

    function defaultOutput(source) {
        return new Folder(childPath(source, "TIFF"));
    }

    function listAiFiles(folder) {
        var files = folder.getFiles(function (entry) {
            return entry instanceof File && /\.ai$/i.test(entry.name);
        });
        if (!files) {
            throw new Error(message("readSource"));
        }
        files.sort(function (a, b) {
            var first = File.decode(a.name).toLowerCase();
            var second = File.decode(b.name).toLowerCase();
            return first < second ? -1 : (first > second ? 1 : 0);
        });
        return files;
    }

    function runBatch(settings) {
        var report = {finished: 0, failed: 0, tiffs: 0, issues: []};
        var previousInteraction = app.userInteractionLevel;
        var previousDocument = app.documents.length ? app.activeDocument : null;
        var progress = showProgress(settings.files.length);
        try {
            app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
            for (var i = 0; i < settings.files.length; i++) {
                var file = settings.files[i];
                var name = File.decode(file.name);
                updateProgress(progress, i, (i + 1) + " / " + settings.files.length + "  " + name);
                exportAiFile(file, name, settings, report);
            }
        } finally {
            app.userInteractionLevel = previousInteraction;
            if (previousDocument) {
                try {
                    previousDocument.activate();
                } catch (activationError) {
                    // The original document may no longer have an active window.
                }
            }
            closeProgress(progress);
        }
        showResult(settings, report);
    }

    function exportAiFile(file, name, settings, report) {
        var doc;
        var openedHere = false;
        var staging;
        var boardNumber = 0;
        var exportedBefore = report.tiffs;

        try {
            doc = findOpenDocument(file);
            if (!doc) {
                var openCount = app.documents.length;
                doc = app.open(file);
                // Keep the window if Illustrator reuses an open document.
                openedHere = app.documents.length > openCount;
            }
            doc.activate();
            var options = createExportOptions(doc, settings);
            var boardCount = doc.artboards.length;
            var firstBoard = ARTBOARDS === "ACTIVE" ? doc.artboards.getActiveArtboardIndex() + 1 : 1;
            var lastBoard = ARTBOARDS === "ACTIVE" ? firstBoard : boardCount;
            var boardDigits = Math.max(2, String(boardCount).length);
            var baseName = name.replace(/\.ai$/i, "")
                .replace(/[<>:"\/\\|?*\x00-\x1F]/g, "_")
                .replace(/[. ]+$/, "") || "Artwork";
            staging = createStagingFolder(settings.output);

            for (boardNumber = firstBoard; boardNumber <= lastBoard; boardNumber++) {
                options.artboardRange = String(boardNumber);
                doc.exportFile(new File(childPath(staging, "export")), ExportType.TIFF, options);
                var stem = boardCount > 1
                    ? baseName + "_" + padNumber(boardNumber, boardDigits)
                    : baseName;
                saveExportedTiff(staging, settings.output, stem, report);
            }

            report.finished++;
        } catch (error) {
            report.failed++;
            var location = boardNumber > 0 ? message("artboard", boardNumber) : "";
            var exported = report.tiffs - exportedBefore;
            var partial = exported ? message("partial", exported) : "";
            report.issues.push(message("fileError", name + location + partial, errorText(error)));
        } finally {
            if (staging && !removeStagingFolder(staging)) {
                report.issues.push(message("fileError", name, message("stagingCleanup", staging.fsName)));
            }
            if (openedHere && doc) {
                try {
                    doc.close(SaveOptions.DONOTSAVECHANGES);
                } catch (closeError) {
                    report.issues.push(message("fileError", name, message("documentClose", errorText(closeError))));
                }
            }
        }
    }

    function findOpenDocument(file) {
        var target = fileKey(file);
        for (var i = 0; i < app.documents.length; i++) {
            var doc = app.documents[i];
            try {
                if (fileKey(doc.fullName) === target) {
                    return doc;
                }
            } catch (unsavedDocument) {
                // A new document may not have a file path yet.
            }
        }
        return null;
    }

    function fileKey(file) {
        var resolved = file.alias ? file.resolve() : null;
        var path = (resolved || file).fsName;
        return File.fs === "Windows" ? path.toLowerCase() : path;
    }

    function createExportOptions(doc, settings) {
        var useCMYK = COLOR_MODE === "CMYK" ||
            (COLOR_MODE === "AUTO" && doc.documentColorSpace === DocumentColorSpace.CMYK);
        var options = new ExportOptionsTIFF();
        options.resolution = settings.ppi;
        options.imageColorSpace = useCMYK ? ImageColorSpace.CMYK : ImageColorSpace.RGB;
        options.byteOrder = TIFFByteOrder.IBMPC;
        options.lZWCompression = settings.lzw;
        options.saveMultipleArtboards = true;
        if (typeof options.embedICCProfile !== "undefined") {
            options.embedICCProfile = true;
        }
        return options;
    }

    function saveExportedTiff(staging, output, stem, report) {
        // Illustrator supplies its own file extension and artboard suffix.
        var files = staging.getFiles(function (entry) {
            return entry instanceof File && /\.tiff?$/i.test(entry.name);
        });
        if (!files || files.length !== 1 || files[0].length <= 0) {
            throw new Error(message("missingTiff"));
        }
        var rendered = files[0];
        var target = availableTarget(output, stem);
        var bytes = rendered.length;
        if (!rendered.copy(target.absoluteURI) || !target.exists || target.length !== bytes) {
            if (target.exists && !target.remove()) {
                throw new Error(message("incompleteTiff", target.fsName));
            }
            throw new Error(message("writeTiff", target.fsName));
        }
        report.tiffs++;
        if (!rendered.remove()) {
            throw new Error(message("tempTiff"));
        }
    }

    function showProgress(total) {
        var dialog;
        try {
            dialog = new Window("palette", message("progress"));
            dialog.alignChildren = "fill";
            dialog.status = dialog.add("statictext", undefined, message("preparing"));
            dialog.status.preferredSize.width = 420;
            dialog.bar = dialog.add("progressbar", undefined, 0, total);
            dialog.bar.preferredSize.height = 13;
            dialog.center();
            dialog.show();
            return dialog;
        } catch (error) {
            closeProgress(dialog);
            return null;
        }
    }

    function updateProgress(dialog, completed, status) {
        if (dialog) {
            try {
                dialog.status.text = status;
                dialog.bar.value = completed;
                dialog.update();
            } catch (error) {
                // A closed or unavailable progress window should not interrupt export.
            }
        }
    }

    function closeProgress(dialog) {
        if (dialog) {
            try {
                dialog.close();
            } catch (error) {
                // The progress window may already be closed.
            }
        }
    }

    function showResult(settings, report) {
        var dialog = new Window("dialog", message("result"));
        dialog.alignChildren = "fill";
        dialog.margins = 18;
        dialog.add("statictext", undefined,
            message("summary", report.finished, settings.files.length, report.tiffs));
        var path = dialog.add("edittext", undefined, settings.output.fsName, {readonly: true});
        path.preferredSize.width = 490;
        if (report.issues.length) {
            dialog.add("statictext", undefined, message("issues", report.failed));
            var details = dialog.add("edittext", undefined, report.issues.join("\n"), {
                multiline: true,
                readonly: true,
                scrolling: true
            });
            details.preferredSize = [490, 150];
        }
        var ok = dialog.add("button", undefined, message("done"), {name: "ok"});
        ok.alignment = "right";
        dialog.show();
    }

    function errorText(error) {
        return error.message || String(error);
    }

    function padNumber(value, digits) {
        var number = String(value);
        while (number.length < digits) {
            number = "0" + number;
        }
        return number;
    }

    function childPath(folder, name) {
        return folder.absoluteURI.replace(/\/$/, "") + "/" + encodeURIComponent(name);
    }

    function availableTarget(folder, stem) {
        var index = 1;
        while (true) {
            var name = (index === 1 ? stem : stem + "_" + index) + ".tif";
            var path = childPath(folder, name);
            var candidate = new File(path);
            if (!candidate.exists && !new Folder(path).exists && !new File(path + "f").exists) {
                return candidate;
            }
            index++;
        }
    }

    function createStagingFolder(folder) {
        var suffix = new Date().getTime() + "-" + Math.floor(Math.random() * 1000000);
        var temporary = new Folder(childPath(folder, "AI-TIFF-temp-" + suffix));
        if (temporary.exists || !temporary.create()) {
            throw new Error(message("createStaging", folder.fsName));
        }
        return temporary;
    }

    function removeStagingFolder(folder) {
        try {
            var files = folder.getFiles();
            for (var i = 0; files && i < files.length; i++) {
                if (files[i] instanceof File) {
                    files[i].remove();
                }
            }
            return folder.remove();
        } catch (cleanupError) {
            return false;
        }
    }
}());
