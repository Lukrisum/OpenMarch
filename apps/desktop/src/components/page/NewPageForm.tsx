import * as Form from "@radix-ui/react-form";
import {
    SelectItem,
    Select,
    SelectContent,
    SelectTriggerButton,
} from "@openmarch/ui";
import { useEffect, useRef, useState } from "react";
import Page, { createPages } from "@/global/classes/Page";
import {
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    Info,
} from "@phosphor-icons/react";
import { Input, Checkbox, Button, TooltipContents } from "@openmarch/ui";
import * as Tooltip from "@radix-ui/react-tooltip";
import { toast } from "sonner";
import { useSidebarModalStore } from "@/stores/SidebarModalStore";
import { PageListContents } from "./PagesModal";
import { useTimingObjectsStore } from "@/stores/TimingObjectsStore";
import type { NewPageArgs } from "electron/database/tables/PageTable";
import Beat, { getNextBeat } from "@/global/classes/Beat";

interface NewPageFormProps {
    hasHeader?: boolean;
    disabledProp?: boolean;
}

/**
 * A form to create new pages.
 *
 * @param {boolean} disabledProp - Whether the form is disabled. False by default.
 * @returns NewPageForm component.
 */
// eslint-disable-next-line react/prop-types
const NewPageForm: React.FC<NewPageFormProps> = ({ disabledProp = false }) => {
    const [previousPage, setPreviousPage] = useState<Page | undefined>(
        undefined,
    );
    const [startBeat, setStartBeat] = useState<Beat | null>(null);
    const [lastCreatedPageId, setLastCreatedPageId] = useState<number | null>(
        null,
    );
    const [counts, setCounts] = useState<number>(8);
    const [formCounts, setFormCounts] = useState<string>(
        counts.toString() || "8",
    ); // used to reset the form when counts changes
    const [quantity, setQuantity] = useState<number>(1);
    const [isSubset, setIsSubset] = useState<boolean>(false);
    const [typing, setTyping] = useState<boolean>(false);
    const { pages, beats, fetchTimingObjects } = useTimingObjectsStore();
    const formRef = useRef<HTMLFormElement>(null);

    const { setContent } = useSidebarModalStore();

    useEffect(() => {
        let newStartBeat = null;
        if (previousPage) {
            const lastBeat = previousPage.beats[previousPage.beats.length - 1];
            newStartBeat = getNextBeat(lastBeat, beats);
        }
        setStartBeat(newStartBeat);
    }, [beats, previousPage]);

    useEffect(() => {
        if (!typing) {
            const handleKeyDown = (event: KeyboardEvent) => {
                const activeElement =
                    document.activeElement as HTMLInputElement;

                if (event.key === "ArrowRight") {
                    setCounts((counts) => counts + 4);
                } else if (event.key === "ArrowLeft") {
                    setCounts((counts) => Math.max(0, counts - 4));
                } else if (
                    event.key === "ArrowUp" &&
                    activeElement.id !== "quantityForm"
                ) {
                    setCounts((counts) => counts + 1);
                } else if (
                    event.key === "ArrowDown" &&
                    activeElement.id !== "quantityForm"
                ) {
                    setCounts((counts) => Math.max(0, counts - 1));
                } else if (event.key === "Enter") {
                    formRef.current?.dispatchEvent(
                        new Event("submit", {
                            cancelable: true,
                            bubbles: true,
                        }),
                    );
                } else if (event.key === "s" || event.key === "S") {
                    event.preventDefault();
                    setIsSubset((isSubset) => !isSubset);
                }
            };

            window.addEventListener("keydown", handleKeyDown);

            return () => {
                window.removeEventListener("keydown", handleKeyDown);
            };
        }
        // eslint-disable-next-line
    }, [typing, counts, isSubset]);

    const resetForm = () => {
        setQuantity(1);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setContent(<PageListContents />);
        if (!startBeat) {
            toast.error("There is no start beat");
            return;
        }
        if (counts && quantity) {
            const newPageArgs: NewPageArgs[] = [];
            for (let i = 0; i < quantity; i++) {
                const newPageArg: NewPageArgs = {
                    start_beat: startBeat.id,
                    is_subset: isSubset,
                };
                newPageArgs.push(newPageArg);
            }

            const response = await createPages(newPageArgs, fetchTimingObjects);

            if (response.success && response.data) {
                response.data.forEach((page) => {
                    toast.success(`New page created successfully`);
                });
                setLastCreatedPageId(
                    response.data.reduce((prev, curr) => {
                        return prev.id > curr.id ? prev : curr;
                    }).id,
                );
            } else {
                console.error(
                    `Error creating pages:`,
                    response.error?.message || "",
                );
                setLastCreatedPageId(null);
                toast.error(`Error creating pages: ${response.error?.message}`);
            }

            resetForm();
        }
    };

    const handlePreviousPageChange = (value: string) => {
        const selectedPageId = parseInt(value);
        if (selectedPageId === -1) setPreviousPage(undefined);
        else
            setPreviousPage(
                pages.find((page) => page.id === selectedPageId) || undefined,
            );
    };

    // Set the previous page to the last page by default when all pages change
    useEffect(() => {
        if (lastCreatedPageId !== null) {
            const pageObj =
                pages.find((page) => page.id === lastCreatedPageId) ?? null;
            setPreviousPage(pageObj ?? undefined);
        } else {
            const lastPage = pages[pages.length - 1];
            setPreviousPage(lastPage);
        }
    }, [lastCreatedPageId, pages]);

    const handleCountsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.value === "") {
            setFormCounts("");
            setCounts(0);
        } else {
            setFormCounts(event.target.value);
            setCounts(parseInt(event.target.value));
        }
    };

    const handleQuantityChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        if (event.target.value === "") setQuantity(1);
        else setQuantity(parseInt(event.target.value));
    };

    const handleIsSubsetChange = (checked: boolean) => {
        setIsSubset(checked);
    };

    function makeButtonString(quantity: number) {
        let suffix = "Page";
        if (quantity > 1) {
            suffix = quantity + " " + suffix + "s";
        }

        return "Create " + suffix;
    }

    // Update the form counts when counts changes
    useEffect(() => {
        if (formCounts !== "" && counts !== 1) {
            setFormCounts(counts.toString());
        }
    }, [counts, formCounts]);

    return (
        <Form.Root
            onSubmit={handleSubmit}
            id="newPageForm"
            ref={formRef}
            className="flex h-full flex-col gap-16"
        >
            <div className="flex flex-col gap-16 px-12">
                <Form.Field
                    name="Quantity"
                    aria-label="new page quantity"
                    className="flex items-center justify-between gap-32"
                >
                    <Form.Label
                        className="text-body text-text/80 w-full"
                        htmlFor="quantityForm"
                    >
                        Quantity
                    </Form.Label>
                    <Form.Control asChild>
                        <Input
                            type="number"
                            defaultValue={1}
                            id="quantityForm"
                            onFocus={() => setTyping(true)}
                            onBlur={() => setTyping(false)}
                            onChange={handleQuantityChange}
                            step={1}
                            min={1}
                        />
                    </Form.Control>
                    <Form.Message
                        match={"valueMissing"}
                        className="text-sub text-red leading-none"
                    >
                        Please enter a value.
                    </Form.Message>
                </Form.Field>
                <Form.Field
                    aria-label="new page previous page"
                    name="Previous Page"
                    className="flex items-center justify-between gap-32"
                >
                    <Form.Label className="text-body text-text/80 w-full">
                        Previous Page
                    </Form.Label>
                    <Form.Control asChild>
                        <Select
                            onValueChange={handlePreviousPageChange}
                            value={previousPage?.id.toString() || "-1"}
                        >
                            <SelectTriggerButton
                                label={previousPage?.toString() || "Prev."}
                                className="w-full"
                            />
                            <SelectContent>
                                {pages.map((page, index) => (
                                    <SelectItem
                                        key={index}
                                        value={`${page.id}`}
                                    >
                                        {page.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Form.Control>
                    <Form.Message
                        match={"valueMissing"}
                        className="text-sub text-red leading-none"
                    >
                        Please enter a value.
                    </Form.Message>
                </Form.Field>

                <Form.Field
                    name="Counts"
                    className="flex items-center justify-between gap-32"
                >
                    <div className="flex gap-8">
                        <Form.Label
                            className="text-body text-text/80 w-full"
                            htmlFor="countsForm"
                        >
                            Counts
                        </Form.Label>
                        <Tooltip.TooltipProvider>
                            <Tooltip.Root>
                                <Tooltip.Trigger type="button">
                                    <Info size={18} className="text-text/60" />
                                </Tooltip.Trigger>
                                <TooltipContents className="p-16">
                                    <div className="flex gap-8">
                                        <ArrowLeft size={18} />
                                        <ArrowRight size={18} />
                                        to increment by 4.
                                    </div>
                                    <div className="flex gap-8">
                                        <ArrowUp size={18} />
                                        <ArrowDown size={18} />
                                        to increment by 1.
                                    </div>
                                </TooltipContents>
                            </Tooltip.Root>
                        </Tooltip.TooltipProvider>
                    </div>
                    <Form.Control asChild>
                        <Input
                            type="number"
                            placeholder="-"
                            aria-label="new page counts"
                            id="countsForm"
                            onFocus={() => setTyping(true)}
                            onBlur={() => {
                                setTyping(false);
                                if (counts === 0) {
                                    setCounts(1);
                                    setFormCounts("1");
                                } else setFormCounts(counts.toString());
                            }}
                            value={formCounts}
                            onChange={handleCountsChange}
                            required
                            min={1}
                            step={1}
                        />
                    </Form.Control>
                    <Form.Message
                        match={"valueMissing"}
                        className="text-sub text-red leading-none"
                    >
                        Please enter a value.
                    </Form.Message>
                </Form.Field>
                <Form.Field
                    name="Subset"
                    aria-label="new page is subset checkbox"
                    className="flex items-center justify-between gap-32"
                >
                    <div className="flex gap-8">
                        <Form.Label
                            htmlFor="subsetForm"
                            className="text-body text-text/80 w-full"
                        >
                            Subset
                        </Form.Label>
                        <Tooltip.TooltipProvider>
                            <Tooltip.Root>
                                <Tooltip.Trigger type="button">
                                    <Info size={18} className="text-text/60" />
                                </Tooltip.Trigger>
                                <TooltipContents className="p-16">
                                    <code className="text-text3 rounded-6 border-stroke border p-4 font-mono">
                                        S
                                    </code>{" "}
                                    to toggle subset.
                                </TooltipContents>
                            </Tooltip.Root>
                        </Tooltip.TooltipProvider>
                    </div>
                    <Checkbox
                        id="subsetForm"
                        checked={isSubset}
                        onCheckedChange={handleIsSubsetChange}
                    />
                    <Form.Message
                        match={"valueMissing"}
                        className="text-sub text-red leading-none"
                    >
                        Please enter a value.
                    </Form.Message>
                </Form.Field>
            </div>
            <Button
                type="submit"
                data-testid="page-form-submit"
                aria-label="create page button"
                className="w-full"
                disabled={disabledProp}
            >
                {makeButtonString(quantity)}
            </Button>
        </Form.Root>
    );
};

export default NewPageForm;
