import { useSelectedAudioFile } from "@/context/SelectedAudioFileContext";
import AudioFile from "@/global/classes/AudioFile";
import { useCallback, useEffect, useState } from "react";
import {
    Select,
    SelectItem,
    SelectContent,
    SelectSeparator,
    SelectTriggerButton,
} from "../ui/Select";
import { RegisteredActionsObjects } from "@/utilities/RegisteredActionsHandler";
import RegisteredActionButton from "../RegisteredActionButton";
import { useTranslation } from "react-i18next";

export default function AudioSelector() {
    const { t } = useTranslation();
    const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
    const { selectedAudioFile, setSelectedAudioFile } = useSelectedAudioFile()!;

    const refreshAudioFiles = useCallback(() => {
        AudioFile.getAudioFilesDetails().then((audioFiles) => {
            setAudioFiles(audioFiles);
        });
    }, [setAudioFiles]);

    const handleSelectChange = useCallback(
        (value: string) => {
            const selectedAudioFileId = parseInt(value);
            AudioFile.setSelectedAudioFile(selectedAudioFileId).then(
                (audioFile) => {
                    setSelectedAudioFile(audioFile);
                },
            );
        },
        [setSelectedAudioFile],
    );

    useEffect(() => {
        refreshAudioFiles();
    }, [refreshAudioFiles, selectedAudioFile]);

    return (
        <div className="flex flex-col gap-12">
            <h5 className="text-h5 leading-none">{t("music.audio.label")}</h5>
            <div className="flex items-center justify-between gap-8 px-12">
                <label
                    htmlFor="audio-selector"
                    className="w-full text-body text-text/80"
                >
                    {t("music.audio.audioFile.label")}
                </label>
                <div id="audio-selector" onClick={refreshAudioFiles}>
                    <Select
                        onValueChange={handleSelectChange}
                        value={`${selectedAudioFile?.id}`}
                    >
                        <SelectTriggerButton
                            label={selectedAudioFile?.nickname || "Import"}
                            className="w-[384px] px-12"
                        />
                        <SelectContent>
                            <RegisteredActionButton
                                registeredAction={
                                    RegisteredActionsObjects.launchInsertAudioFileDialogue
                                }
                                showTooltip={false}
                                className="text-text"
                            >
                                {t("music.audio.audioFile.import")}
                            </RegisteredActionButton>
                            {audioFiles.length > 0 && <SelectSeparator />}
                            {audioFiles.map((audioFile) => (
                                <SelectItem
                                    key={audioFile.id}
                                    value={`${audioFile.id}`}
                                >
                                    {audioFile.nickname}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
