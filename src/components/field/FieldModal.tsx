import { useSidebarModalStore } from "@/stores/SidebarModalStore";
import { SidebarModalLauncher } from "@/components/sidebar/SidebarModal";
import { X } from "@phosphor-icons/react";
import FieldProperties from "./FieldPropertiesSettings";
import { useTranslation } from "react-i18next";

export default function FieldModal() {
    const { t } = useTranslation();
    return (
        <SidebarModalLauncher
            contents={<FieldPropertiesContents />}
            buttonLabel={t("field.label")}
        />
    );
}

export function FieldPropertiesContents() {
    const { toggleOpen } = useSidebarModalStore();
    const { t } = useTranslation();

    return (
        <div className="flex w-fit animate-scale-in flex-col gap-16 text-text">
            <header className="flex items-center justify-between gap-24">
                <h4 className="text-h4 leading-none">{t("field.label")}</h4>
                <div className="flex items-center gap-8">
                    <button
                        onClick={toggleOpen}
                        className="duration-150 ease-out hover:text-red"
                    >
                        <X size={24} />
                    </button>
                </div>
            </header>
            <FieldProperties />
        </div>
    );
}
