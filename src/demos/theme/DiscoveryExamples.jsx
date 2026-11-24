import React, {useEffect, useId, useMemo, useState} from 'react';
import {signal} from '@preact/signals-react';
import CardRail from '../../components/content/CardRail.jsx';
import CardRailGroup from '../../components/content/CardRailGroup.jsx';
import ContentCarousel from '../../components/content/ContentCarousel.jsx';
import FilterChips from '../../components/content/FilterChips.jsx';
import {toggleChipValue} from '../../components/content/contentModel.js';
import DataStateBoundary from '../../components/primitives/DataStateBoundary.jsx';
import Typography from '../../components/Typography.jsx';
import WidgetRenderer from '../../runtime/WidgetRenderer.jsx';
import contentImage from './assets/discovery-content.svg?url&no-inline';
import featuredImage from './assets/discovery-featured.svg?url&no-inline';
import featuredGraphic from './assets/discovery-featured-graphic.svg?url&no-inline';

// Independently invented documentation records. These examples never call a product service.
const topics = [
    {value:'design', label:'Design'},
    {value:'engineering', label:'Engineering'},
    {value:'research', label:'Research'},
    {value:'guidance', label:'Guidance'},
];
const resources = [
    {id:'guide-1', title:'Foundation guide', topics:['design'], count:'24'},
    {id:'guide-2', title:'Component anatomy', topics:['design','engineering','research','guidance'], count:'18'},
    {id:'guide-3', title:'Research handbook', topics:['research'], count:'12'},
    {id:'guide-4', title:'Field patterns', topics:['design'], count:'16'},
    {id:'guide-5', title:'Keyboard navigation', topics:['engineering'], count:'10'},
    {id:'guide-6', title:'Usability findings', topics:['research'], count:'8'},
];
const makeCards = (selected, detailed=true) => resources.map((row,index)=>({
    id:row.id, title:row.title, image:contentImage,
    imageAlt:'Illustrative document', imageFit:'contain',
    ...(detailed ? {
        subtitle:`GUIDE-${String(index+1).padStart(2,'0')}`,
        copyValue:`GUIDE-${String(index+1).padStart(2,'0')}`, copyLabel:'resource ID',
        facts:[{label:'Items',value:row.count},{label:'Updated',value:'Nov 12'}],
        tags:row.topics.map(id=>({id,kind:'topic',label:topics.find(topic=>topic.value===id).label,selected:selected.includes(id)})),
    } : {}),
}));

export function DiscoveryCarouselExample({variant='Manual',state='Default'}) {
    const [feedback,setFeedback]=useState('');
    const featured=variant==='Featured'||variant==='Autoplay';
    const slides=resources.slice(0,3).map(row=>({id:row.id,title:row.title,
        description:'Explore shared guidance and practical examples.',
        ...(featured?{image:featuredImage,graphicImage:featuredGraphic,actionLabel:'View collection'}:{}),
    }));
    return <div className="catalog-pattern-example catalog-pattern-section">
        <ContentCarousel value={slides} disabled={state==='Disabled'} aria-label="Featured resource collections"
            wholeSlideAction={featured} autoRotateMs={variant==='Autoplay'?6000:0}
            onClick={event=>setFeedback(`Selected ${event.detail.item.title}.`)}/>
        {feedback&&<Typography as="p" typeRole="small" role="status">{feedback}</Typography>}
    </div>;
}

export function CardRailExample({variant='Default',state='Default',group=false}) {
    const id=useId();
    const [selected,setSelected]=useState([]),[feedback,setFeedback]=useState('');
    const fields=useState({query:''});
    const detailed=variant!=='Default'||group;
    const withFilters=variant==='With filters';
    const disabled=state==='Disabled';
    const allCards=makeCards(selected,detailed);
    const query=fields[0].query.trim().toLocaleLowerCase();
    const cards=state==='Empty'?[]:allCards.filter(row=>(
        (!selected.length||resources.find(resource=>resource.id===row.id).topics.some(topic=>selected.includes(topic)))
        &&(!withFilters||!query||row.title.toLocaleLowerCase().includes(query))
    ));
    const onTagClick=event=>{
        const tag=event.detail.tag;
        setSelected(current=>toggleChipValue(current,tag.id,!current.includes(tag.id)));
    };
    const onClick=event=>setFeedback(`Selected ${event.detail.item.title}.`);
    const onCountClick=()=>setFeedback('Collection selected.');
    const sections=cards.length?[
        {id:'featured',heading:'Featured resources',description:'A curated selection of example guides.',totalCount:Math.min(cards.length,3),countHint:'View featured resources',value:cards.slice(0,3)},
        {id:'all',heading:'All resources',description:'Browse the complete example collection.',totalCount:cards.length,countHint:'View all resources',value:cards},
    ]:[];
    return <div className="catalog-pattern-example catalog-pattern-section">
        {withFilters&&<>
            <WidgetRenderer state={fields} item={{id:`${id}-search`,name:'query',widget:'text',scope:'local',dataField:'query',label:'Search resources',disabled,
                properties:{type:'search',leftIcon:'search',placeholder:'Search resources'}}}/>
            <Typography as="span" typeRole="label">Topics</Typography>
            <FilterChips aria-label="Resource topics" value={selected} options={topics} onChange={setSelected} disabled={disabled}/>
        </>}
        {group?<CardRailGroup value={sections} disabled={disabled} onClick={onClick} onTagClick={onTagClick} onCountClick={onCountClick} emptyText="No resources match these filters."/>
            :<CardRail id={`${id}-rail`} heading="Resource collection" description="Browse independently authored example records."
                value={cards} totalCount={cards.length} countHint="View all resources" disabled={disabled}
                onClick={onClick} onTagClick={detailed?onTagClick:undefined} onCountClick={onCountClick}/>
        }
        {feedback&&<Typography as="p" typeRole="small" role="status">{feedback}</Typography>}
    </div>;
}

export function DiscoveryDataStateExample({state='Default'}) {
    const context=useMemo(()=>{
        const source={signals:{control:signal({loaded:true}),collection:signal(resources),form:signal({})},handlers:{}};
        source.Context=()=>source;
        source.handlers.dataSource={fetchCollection:()=>{
            source.signals.collection.value=resources;
            source.signals.control.value={loaded:true};
        }};
        return source;
    },[]);
    useEffect(()=>{
        context.signals.collection.value=state==='Empty'||state==='Error'?[]:resources;
        context.signals.control.value=state==='Loading'?{loading:true,loaded:false}:state==='Error'?{loaded:true,error:{message:'The example resources could not be loaded.'}}:{loaded:true};
    },[state,context]);
    return <div className="catalog-pattern-example">
        <DataStateBoundary context={context} container={{dataSourceRef:'resources',dataStateBoundary:{dataSourceRefs:['resources'],
            loadingMessage:'Loading resources…',emptyMessage:'No resources yet.',errorMessage:'Resources could not be loaded.',
            errorAction:{label:'Retry',dataSourceRef:'resources',bypassCache:true}}}}>
            <Typography as="p" typeRole="body">Browse shared resource collections.</Typography>
        </DataStateBoundary>
    </div>;
}
