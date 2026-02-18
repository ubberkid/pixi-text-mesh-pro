import { describe, it, expect } from 'vitest';
import { RichTextParser } from '../../src/parser/RichTextParser';

describe('Phase 5 Parser Tags', () => {
    const parser = new RichTextParser();
    const BASE_SIZE = 32;
    const BASE_COLOR = 0xffffff;
    const BASE_FONT = 'TestFont';

    function parse(text: string) {
        return parser.parse(text, BASE_SIZE, BASE_COLOR, BASE_FONT);
    }

    describe('<uppercase> alias', () => {
        it('should uppercase text like <allcaps>', () => {
            const result = parse('<uppercase>hello</uppercase>');
            expect(result[0].char).toBe('H');
            expect(result[4].char).toBe('O');
        });

        it('should restore case after close', () => {
            const result = parse('<uppercase>hi</uppercase>lo');
            expect(result[0].char).toBe('H');
            expect(result[2].char).toBe('l');
        });
    });

    describe('<strikethrough> alias', () => {
        it('should set strikethrough like <s>', () => {
            const result = parse('<strikethrough>AB</strikethrough>C');
            expect(result[0].strikethrough).toBe(true);
            expect(result[1].strikethrough).toBe(true);
            expect(result[2].strikethrough).toBe(false);
        });
    });

    describe('<nbsp> tag', () => {
        it('should insert non-breaking space character', () => {
            const result = parse('A<nbsp>B');
            expect(result).toHaveLength(3);
            expect(result[1].char).toBe('\u00A0');
            expect(result[1].isNoBreak).toBe(true);
        });
    });
});
