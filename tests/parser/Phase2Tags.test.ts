import { describe, it, expect } from 'vitest';
import { RichTextParser } from '../../src/parser/RichTextParser';
import { TMPStyleSheet } from '../../src/styles/TMPStyleSheet';

describe('Phase 2 Parser Tags', () => {
    const parser = new RichTextParser();
    const BASE_SIZE = 32;
    const BASE_COLOR = 0xffffff;
    const BASE_FONT = 'TestFont';

    function parse(text: string) {
        return parser.parse(text, BASE_SIZE, BASE_COLOR, BASE_FONT);
    }

    describe('<u> and <s> tags', () => {
        it('should set underline', () => {
            const result = parse('A<u>B</u>C');
            expect(result[0].underline).toBe(false);
            expect(result[1].underline).toBe(true);
            expect(result[2].underline).toBe(false);
        });

        it('should set strikethrough', () => {
            const result = parse('A<s>B</s>C');
            expect(result[0].strikethrough).toBe(false);
            expect(result[1].strikethrough).toBe(true);
            expect(result[2].strikethrough).toBe(false);
        });
    });

    describe('<mark> tag', () => {
        it('should set mark color', () => {
            const result = parse('A<mark=#ffcc00>B</mark>C');
            expect(result[0].markColor).toBe(0);
            expect(result[1].markColor).toBe(0xffcc00);
            expect(result[2].markColor).toBe(0);
        });
    });

    describe('<align> tag', () => {
        it('should set alignment', () => {
            const result = parse('<align=center>Centered</align>');
            for (const pc of result) {
                expect(pc.align).toBe('center');
            }
        });

        it('should restore alignment on close', () => {
            const result = parse('A<align=right>B</align>C');
            expect(result[0].align).toBe('');
            expect(result[1].align).toBe('right');
            expect(result[2].align).toBe('');
        });
    });

    describe('<voffset> tag', () => {
        it('should set vertical offset', () => {
            const result = parse('A<voffset=10>B</voffset>C');
            expect(result[0].voffset).toBe(0);
            expect(result[1].voffset).toBe(10);
            expect(result[2].voffset).toBe(0);
        });
    });

    describe('<indent> tag', () => {
        it('should set indent value', () => {
            const result = parse('<indent=20>A</indent>B');
            expect(result[0].indent).toBe(20);
            expect(result[1].indent).toBe(0);
        });
    });

    describe('<margin> tag', () => {
        it('should set margin value', () => {
            const result = parse('<margin=15>A</margin>B');
            expect(result[0].marginLeft).toBe(15);
            expect(result[0].marginRight).toBe(15);
            expect(result[1].marginLeft).toBe(0);
            expect(result[1].marginRight).toBe(0);
        });
    });

    describe('<line-height> tag', () => {
        it('should set line height override', () => {
            const result = parse('<line-height=50>A</line-height>B');
            expect(result[0].lineHeightOverride).toBe(50);
            expect(result[1].lineHeightOverride).toBe(0);
        });
    });

    describe('<allcaps> tag', () => {
        it('should uppercase characters', () => {
            const result = parse('<allcaps>hello</allcaps>');
            expect(result.map(c => c.char).join('')).toBe('HELLO');
        });

        it('should restore case after close', () => {
            const result = parse('a<allcaps>b</allcaps>c');
            expect(result[0].char).toBe('a');
            expect(result[1].char).toBe('B');
            expect(result[2].char).toBe('c');
        });
    });

    describe('<lowercase> tag', () => {
        it('should lowercase characters', () => {
            const result = parse('<lowercase>HELLO</lowercase>');
            expect(result.map(c => c.char).join('')).toBe('hello');
        });
    });

    describe('<smallcaps> tag', () => {
        it('should uppercase with reduced size for lowercase input', () => {
            const result = parse('<smallcaps>aB</smallcaps>');
            expect(result[0].char).toBe('A');
            expect(result[0].fontSize).toBe(BASE_SIZE * 0.8);
            // Already uppercase — no size change
            expect(result[1].char).toBe('B');
            expect(result[1].fontSize).toBe(BASE_SIZE);
        });
    });

    describe('<sub> and <sup> tags', () => {
        it('should set subscript with reduced size', () => {
            const result = parse('A<sub>2</sub>');
            expect(result[0].isSubscript).toBe(false);
            expect(result[1].isSubscript).toBe(true);
            expect(result[1].fontSize).toBe(BASE_SIZE * 0.5);
        });

        it('should set superscript with reduced size', () => {
            const result = parse('x<sup>2</sup>');
            expect(result[0].isSuperscript).toBe(false);
            expect(result[1].isSuperscript).toBe(true);
            expect(result[1].fontSize).toBe(BASE_SIZE * 0.5);
        });

        it('should restore size after close', () => {
            const result = parse('A<sup>B</sup>C');
            expect(result[0].fontSize).toBe(BASE_SIZE);
            expect(result[1].fontSize).toBe(BASE_SIZE * 0.5);
            expect(result[2].fontSize).toBe(BASE_SIZE);
        });
    });

    describe('<link> and <a> tags', () => {
        it('should set link with id', () => {
            const result = parse('A<link="page1">click</link>B');
            expect(result[0].isLink).toBe(false);
            expect(result[1].isLink).toBe(true);
            expect(result[1].linkId).toBe('page1');
            expect(result[5].isLink).toBe(true);
            expect(result[6].isLink).toBe(false);
        });

        it('should handle <a> tag with href', () => {
            const result = parse('<a href="https://example.com">link</a>');
            expect(result[0].isLink).toBe(true);
            expect(result[0].linkId).toBe('https://example.com');
        });
    });

    describe('<font> tag', () => {
        it('should change font family', () => {
            const result = parse('A<font="Arial">B</font>C');
            expect(result[0].fontFamily).toBe(BASE_FONT);
            expect(result[1].fontFamily).toBe('Arial');
            expect(result[2].fontFamily).toBe(BASE_FONT);
        });
    });

    describe('<cspace> tag', () => {
        it('should set character spacing', () => {
            const result = parse('A<cspace=5>B</cspace>C');
            expect(result[0].cspace).toBe(0);
            expect(result[1].cspace).toBe(5);
            expect(result[2].cspace).toBe(0);
        });
    });

    describe('<mspace> tag', () => {
        it('should set monospace width', () => {
            const result = parse('A<mspace=20>B</mspace>C');
            expect(result[0].mspace).toBe(0);
            expect(result[1].mspace).toBe(20);
            expect(result[2].mspace).toBe(0);
        });
    });

    describe('<nobr> tag', () => {
        it('should set noBreak flag', () => {
            const result = parse('A <nobr>no break</nobr> B');
            expect(result[0].isNoBreak).toBe(false);
            expect(result[2].isNoBreak).toBe(true); // 'n'
            expect(result[9].isNoBreak).toBe(true); // 'k'
        });
    });

    describe('<space> tag', () => {
        it('should add extra space to next char', () => {
            const result = parse('A<space=10>B');
            expect(result[0].extraSpace).toBe(0);
            expect(result[1].extraSpace).toBe(10);
        });
    });

    describe('<pos> tag', () => {
        it('should set fixed position on next char', () => {
            const result = parse('A<pos=100>B');
            expect(isNaN(result[0].fixedPosition)).toBe(true);
            expect(result[1].fixedPosition).toBe(100);
        });
    });

    describe('<style> tag', () => {
        it('should apply style preset', () => {
            const styles = TMPStyleSheet.fromJSON({
                warning: { open: '<color=#ff4400><b>', close: '</b></color>' },
            });
            parser.styleSheet = styles;

            const result = parse('A<style="warning">B</style>C');
            expect(result[0].color).toBe(BASE_COLOR);
            expect(result[0].bold).toBe(false);
            expect(result[1].color).toBe(0xff4400);
            expect(result[1].bold).toBe(true);
            expect(result[2].color).toBe(BASE_COLOR);
            expect(result[2].bold).toBe(false);

            parser.styleSheet = null;
        });
    });

    describe('combined Phase 2 tags', () => {
        it('should handle multiple tags on same character', () => {
            const result = parse('<u><b><color=#ff0000>X</color></b></u>');
            expect(result[0].underline).toBe(true);
            expect(result[0].bold).toBe(true);
            expect(result[0].color).toBe(0xff0000);
        });

        it('should handle nested align and case transforms', () => {
            const result = parse('<align=center><allcaps>hello</allcaps></align>');
            expect(result[0].align).toBe('center');
            expect(result[0].char).toBe('H');
            expect(result.map(c => c.char).join('')).toBe('HELLO');
        });
    });
});
