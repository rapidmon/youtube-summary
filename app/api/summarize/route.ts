import { GoogleGenerativeAI } from '@google/generative-ai';
import { YoutubeTranscript } from 'youtube-transcript';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const SUMMARY_PROMPT = `
<system>
너는 유튜브 학습 도우미야. 영상 유형을 자동으로 파악해서 최적의 형태로 정리해.

역할:
- 사용자가 유튜브나 기타 플랫폼의 영상 링크를 붙여넣으면,
  가능한 경우 영상의 자막/대사를 기반으로 핵심 내용을 요약해서 제공한다.
- 사용자가 한국어로 말하면 한국어로, 다른 언어로 말하면 그 언어로 답한다
  (멀티 언어 지원).

요약 방식:
1. 영상의 전체 흐름을 3~7개 정도의 bullet point로 정리한다. time stamp와 함께 제공한다.
2. 중요한 개념, 숫자, 주장, 결론을 명확하게 적는다.
3. 교육·연구 목적에 맞게, 지나치게 가벼운 표현보다는
   이해하기 쉬운 설명 위주로 쓴다.

[영상 유형별 추가 정리]
- 강의/교육: 개념 정의 + 예시 포함
- 뉴스/시사: 육하원칙(누가/언제/어디서/무엇을) 명시
- 리뷰/비교: 장단점 구분
- 일반: 기본 형식 유지
</system>

<output_format>
## 주제
영상의 주제

## 전체 내용 with bullet point
bullet point 1
bullet point 2
...

## 한줄 요약
(핵심 메시지)

## 핵심 포인트 (3개)
- 
- 
- 

## 알아두면 좋은 용어 (최대 3개)
- **용어**: 뜻
(없으면 생략)

## 이 영상의 포인트
(이 영상을 한 문장으로 기억한다면?)
</output_format>

<rules>
- 한국어로 작성
- 영상에 없는 내용 추가 금지
- 불확실한 내용은 "~로 추정됨" 표시
- 실제로 영상 파일에 직접 접근하거나 재생하는 척하지 않는다.
  (예: ‘지금 영상 3분 20초를 재생해 보니…’ 같은 식으로 꾸며서 말하지 않는다.)
- 영상의 자막/텍스트가 충분하지 않을 것으로 보이는 경우
  “추정 요약”임을 분명히 밝힌다.
</rules>
`;

// 자막 가져오기 시도
async function tryGetTranscript(url: string) {
  try {
    const transcripts = await YoutubeTranscript.fetchTranscript(url);
    const text = transcripts.map((t) => t.text).join(' ');
    return text.length > 100 ? { success: true, text } : { success: false, text: '' };
  } catch {
    return { success: false, text: '' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL이 필요합니다' }, { status: 400 });
    }

    // 1. 자막 시도
    const transcript = await tryGetTranscript(url);

    let result;

    if (transcript.success) {
      // 자막 기반 요약
      result = await model.generateContent(
        `${SUMMARY_PROMPT}\n\n<transcript>\n${transcript.text}\n</transcript>`
      );
    } else {
      // 영상 직접 분석
      result = await model.generateContent([
        { fileData: { fileUri: url } },
        { text: SUMMARY_PROMPT },
      ]);
    }

    const summary = result.response.text();

    return NextResponse.json({
      success: true,
      summary,
      method: transcript.success ? 'transcript' : 'video',
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: '요약 생성에 실패했습니다' },
      { status: 500 }
    );
  }
}