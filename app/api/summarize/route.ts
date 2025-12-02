import { GoogleGenerativeAI } from '@google/generative-ai';
import { Innertube } from 'youtubei.js';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const SUMMARY_PROMPT = `
<system>
너는 유튜브 학습 도우미야. 내가 주는 자막들로 영상을 파악해서 최적의 형태로 정리해.

역할:
- 자막/대사를 기반으로 핵심 내용을 요약해서 제공한다.
- 사용자가 한국어로 말하면 한국어로, 다른 언어로 말하면 그 언어로 답한다
  (멀티 언어 지원).

요약 방식:
1. 영상의 전체 흐름을 3~7개 정도의 bullet point로 정리한다. time stamp와 함께 제공한다.
2. 중요한 개념, 숫자, 주장, 결론을 명확하게 적는다.
3. 교육·연구 목적에 맞게, 지나치게 가벼운 표현보다는 이해하기 쉬운 설명 위주로 쓴다.

[영상 유형별 추가 정리]
- 강의/교육: 개념 정의 + 예시 포함
- 뉴스/시사: 육하원칙(누가/언제/어디서/무엇을) 명시
- 리뷰/비교: 장단점 구분
- 일반: 기본 형식 유지
</system>

<output_format>
주제
영상의 주제

전체 내용 with bullet point
bullet point 1
bullet point 2
...

한줄 요약
(핵심 메시지)

핵심 포인트 (3개)
- 
- 
- 

알아두면 좋은 용어 (최대 3개)
- 용어: 뜻
(없으면 생략)

이 영상의 포인트
(이 영상을 한 문장으로 기억한다면?)
</output_format>

<rules>
- 한국어로 작성
- 영상에 없는 내용 추가 금지
- 불확실한 내용은 "~로 추정됨" 표시
</rules>
`;

async function getTranscript(url: string) {
  try {
    const videoId = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1];
    
    if (!videoId) {
      return { success: false, text: '', error: 'Invalid YouTube URL' };
    }

    const yt = await Innertube.create();
    
    // 방법 1: getTranscript 직접 시도
    try {
      const info = await yt.getInfo(videoId);
      const transcriptData = await info.getTranscript();
      
      const segments = transcriptData?.transcript?.content?.body?.initial_segments || [];
      const text = segments
        .map((seg: any) => seg?.snippet?.text || '')
        .join(' ')
        .trim();

      if (text && text.length >= 10) {
        return { success: true, text };
      }
    } catch (e) {
      console.log('방법 1 실패, 방법 2 시도...');
    }

    // 방법 2: captions에서 가져오기
    try {
      const info = await yt.getBasicInfo(videoId);
      const captions = info.captions?.caption_tracks;
      
      if (captions && captions.length > 0) {
        const captionUrl = captions[0].base_url;
        const response = await fetch(captionUrl);
        const xml = await response.text();
        
        // XML에서 텍스트 추출
        const textMatches = xml.match(/<text[^>]*>([^<]*)<\/text>/g) || [];
        const text = textMatches
          .map(t => t.replace(/<[^>]+>/g, '').trim())
          .join(' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"');

        if (text && text.length >= 10) {
          return { success: true, text };
        }
      }
    } catch (e) {
      console.log('방법 2도 실패:', e);
    }

    return { success: false, text: '', error: '자막을 가져올 수 없습니다' };
  } catch (error) {
    return { success: false, text: '', error: String(error) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL이 필요합니다' }, { status: 400 });
    }

    // 1. 자막 가져오기
    const transcript = await getTranscript(url);

    if (!transcript.success) {
      return NextResponse.json({ 
        success: false, 
        error: transcript.error || '자막을 가져올 수 없습니다' 
      }, { status: 400 });
    }

    // 2. Gemini로 요약
    const result = await model.generateContent(
      `${SUMMARY_PROMPT}\n\n<transcript>\n${transcript.text}\n</transcript>`
    );

    const summary = result.response.text();

    return NextResponse.json({
      success: true,
      summary,
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: '요약 생성에 실패했습니다' },
      { status: 500 }
    );
  }
}