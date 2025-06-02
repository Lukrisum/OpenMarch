import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportCoordinatesModal from './ExportCoordinatesModal';
import { coordinateRoundingOptions } from '../../config/exportOptions';
import * as Dialog from '@radix-ui/react-dialog';
import { describe, it, expect, vi } from 'vitest';

// Minimal mocks for contexts/stores used by the component
// These might need to be more sophisticated depending on the actual component interaction with them.
vi.mock('@/context/fieldPropertiesContext', () => ({
    useFieldProperties: () => ({
        fieldProperties: {
            // Provide a minimal mock FieldProperties object
            centerFrontPoint: { xPixels: 0, yPixels: 0 },
            pixelsPerStep: 8,
            xCheckpoints: [],
            yCheckpoints: [],
            sideDescriptions: { terseLeft: 'S1', terseRight: 'S2' },
        },
    }),
}));

vi.mock('@/stores/MarcherPageStore', () => ({
    useMarcherPageStore: () => ({
        marcherPages: [],
    }),
}));

vi.mock('@/stores/TimingObjectsStore', () => ({
    useTimingObjectsStore: () => ({
        pages: [],
    }),
}));

// Mock the toast utility
vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));


// Helper to render the modal within a Dialog.Root
const renderModal = () => {
    // Mock function for onClose, as it's a required prop -- removed, as it's not a prop of ExportCoordinatesModal
    // const mockOnClose = vi.fn(); 
    // Ensure the component is part of the Dialog tree for Radix components to function
    return render(
        <Dialog.Root open={true}>
            <Dialog.Portal>
                <Dialog.Overlay />
                <Dialog.Content>
                    <ExportCoordinatesModal />
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

describe('ExportCoordinatesModal', () => {
    describe('Coordinate Rounding Dropdown', () => {
        it('should display the dropdown with the correct label', () => {
            renderModal();
            expect(screen.getByText('Coordinate Rounding')).toBeInTheDocument();
        });

        it('should have the correct default option pre-selected (Quarter Step)', async () => {
            renderModal();
            // The Radix Select Trigger will display the label of the selected item.
            // The default value is "4", which corresponds to "Quarter Step".
            const selectTrigger = screen.getByRole('combobox');
            expect(selectTrigger).toHaveTextContent('Quarter Step');
        });

        it('should display all rounding options when opened', async () => {
            renderModal();
            const user = userEvent.setup();
            const selectTrigger = screen.getByRole('combobox');
            
            await user.click(selectTrigger);

            // Wait for options to appear (Radix might animate or load them)
            for (const option of coordinateRoundingOptions) {
                expect(await screen.findByText(option.label)).toBeInTheDocument();
            }
        });

        it('should update the selected option when a new option is clicked', async () => {
            renderModal();
            const user = userEvent.setup();
            const selectTrigger = screen.getByRole('combobox');

            // Open dropdown
            await user.click(selectTrigger);

            // Select "Half Step" (value "2")
            const halfStepOption = await screen.findByText('Half Step');
            await user.click(halfStepOption);

            // The trigger should now display "Half Step"
            await waitFor(() => {
                expect(selectTrigger).toHaveTextContent('Half Step');
            });

            // As a further check, let's try another one: "Tenth Step"
            await user.click(selectTrigger); // Re-open
            const tenthStepOption = await screen.findByText('Tenth Step');
            await user.click(tenthStepOption);

            await waitFor(() => {
                expect(selectTrigger).toHaveTextContent('Tenth Step');
            });
        });
    });

    // TODO: Add more tests for other functionality of the modal:
    // - Terse/Verbose switch
    // - Include Measures switch
    // - Use X/Y switch
    // - Organize by Section switch
    // - Export button functionality (mocking the export process)
});

// A basic Vitest setup for jsdom environment if not already configured globally
// This ensures toBeInTheDocument and other jest-dom matchers are available.
// Often this is in a setup file, but can be here for a self-contained example.
// import '@testing-library/jest-dom'; // If using vitest with jest-dom separately 