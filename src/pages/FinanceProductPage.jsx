import { Link } from 'react-router-dom';
import SpotlightCard from '../components/ui/SpotlightCard';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { createWhatsAppUrl } from '../utils/whatsapp';
import '../styles/finance-product.css';

const paymentLink = 'https://mpago.la/2rHeNqX';
const deliveryContact = createWhatsAppUrl('Olá! Comprei o template Meu Dinheiro, Minhas Regras. Meu e-mail para entrega é: [preencher]. Número da transação Mercado Pago: [preencher].');
const manualDeliveryNotice = 'Após o pagamento, informe seu e-mail de entrega e o número da transação pelo WhatsApp. Seu template será enviado por e-mail em até 24 horas após a confirmação do pagamento.';
const manualServiceNotice = 'Pagamento no Mercado Pago. Atendimento e entrega manuais nesta fase.';
const areas = ['Contas e bancos', 'Entradas e saídas', 'Despesas e categorias', 'Compras parceladas', 'Metas e objetivos', 'Resumos financeiros'];
const included = ['Template financeiro para Notion, pronto para duplicar.', 'Organização de entradas e saídas.', 'Acompanhamento de contas e saldos.', 'Registro de despesas e categorias.', 'Controle de compras parceladas.', 'Espaço para metas e objetivos.', 'Exemplos e orientações para começar.'];
function NotionLabel() {
  return <span className="fj-notion"><img src="/assets/notion-platform.ico" width="25" height="25" alt="" /> Para Notion</span>;
}
function Preview({ label, hero = false }) {
  return <figure className={`fj-preview ${hero ? 'fj-preview--hero' : ''}`}>
    <div className="fj-window" aria-hidden="true"><i /><i /><i /><span>MEU DINHEIRO, MINHAS REGRAS</span></div>
    <a className="fj-preview-image" href={hero ? '/assets/finance-template/visao-geral.jpg' : label.startsWith('Contas') ? '/assets/finance-template/contas-entradas.jpg' : '/assets/finance-template/parcelas-resumo.jpg'} target="_blank" rel="noopener noreferrer" aria-label={`Ampliar captura real: ${label}`}>
      <img src={hero ? '/assets/finance-template/visao-geral.jpg' : label.startsWith('Contas') ? '/assets/finance-template/contas-entradas.jpg' : '/assets/finance-template/parcelas-resumo.jpg'} alt={hero ? 'Captura real da página Meu Dinheiro, Minhas Regras no Notion, com índice, ações rápidas e entradas do mês.' : label.startsWith('Contas') ? 'Captura real das contas bancárias e entradas demonstrativas no Notion.' : 'Captura real dos parcelamentos e resumos mensais demonstrativos no Notion.'} width="2000" height={hero ? 893 : label.startsWith('Contas') ? 937 : 894} loading={hero ? 'eager' : 'lazy'} />
    </a>
    <figcaption>{hero ? 'Uma estrutura para organizar. Liberdade para fazer do seu jeito.' : label}</figcaption>
  </figure>;
}
export default function FinanceProductPage() {
  useDocumentMeta({ title: 'Meu Dinheiro, Minhas Regras | Shopping Join', description: 'Organize entradas, despesas, saldos e parcelas com um template financeiro para Notion. Pagamento único de R$ 47.', path: '/meu-dinheiro-minhas-regras', noindex: true });
  return <div className="finance-landing">
    <a className="fj-skip" href="#conteudo">Pular para o conteúdo</a>
    <header className="fj-header fj-wrap"><Link to="/" className="fj-brand">RENATAJOIN<span>/ SHOPPING JOIN / PRODUTOS DIGITAIS</span></Link><span className="fj-brazil"><span aria-hidden="true">🇧🇷</span> Feito no Brasil</span></header>
    <main id="conteudo">
      <section className="fj-hero fj-wrap">
        <div className="fj-hero-copy"><p className="fj-kicker">ORGANIZAÇÃO FINANCEIRA NO NOTION</p><h1>O governo muda.<br /><em>Suas contas continuam chegando.</em></h1><p>Independentemente de quem esteja no poder, a responsabilidade de cuidar do seu dinheiro é sua.</p><p>O primeiro passo para ter mais controle sobre sua vida financeira é saber o que entra, o que sai e para onde vai cada real.</p><a className="fj-cta" href={paymentLink}>Comprar agora — R$ 47 <span aria-hidden="true">↗</span></a><small>Pagamento único · Template digital · Para Notion</small><small>{manualServiceNotice}</small><small>{manualDeliveryNotice}</small><a className="fj-delivery-link" href={deliveryContact}>Informar dados para entrega</a></div>
        <div className="fj-hero-art"><div className="fj-art-label"><span>MEU DINHEIRO,<br /><strong>MINHAS REGRAS.</strong></span><NotionLabel /></div><Preview hero label="Seu dinheiro, em perspectiva." /><div className="fj-art-foot"><span>MENOS IMPROVISO.</span><span>MAIS CONSCIÊNCIA.</span></div></div>
      </section>
      <section className="fj-benefits fj-wrap" aria-label="Benefícios">{[['Clareza','Enxergue seu orçamento com facilidade.'],['Controle','Reúna contas, despesas e parcelas em um só lugar.'],['Planejamento','Defina metas e acompanhe sua evolução.'],['Autonomia','Tome decisões com base em informações organizadas.']].map(([title, text], i)=><div key={title}><svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.3">{i===0?<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></>:i===1?<><path d="M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6"/></>:i===2?<><rect x="4" y="5" width="16" height="15" rx="1"/><path d="M8 3v4M16 3v4M4 10h16m-11 5 2 2 4-4"/></>:<><path d="m4 18 14-14M8 4h10v10M4 10v10h10"/></>}</svg><h2>{title}</h2><p>{text}</p></div>)}</section>
      <section className="fj-context fj-wrap"><div><p className="fj-kicker">O QUE ESTÁ AO SEU ALCANCE</p><h2>Você não controla todas as decisões econômicas do país.<br /><em>Mas pode organizar aquilo que está ao seu alcance.</em></h2><p>Impostos, inflação, contas, compras parceladas… tudo isso afeta o seu orçamento.</p><p>O Meu Dinheiro, Minhas Regras é a estrutura que ajuda você a manter suas informações financeiras organizadas, mesmo em cenários incertos.</p></div><blockquote><span aria-hidden="true">“</span>Você não precisa de mais uma promessa de enriquecimento. Precisa saber o que está acontecendo com o dinheiro que já passa pelas suas mãos.<footer>CLAREZA ANTES DE QUALQUER PRÓXIMO PASSO.</footer></blockquote></section>
      <section className="fj-inside fj-wrap"><div className="fj-section-head"><div><p className="fj-kicker">POR DENTRO DO TEMPLATE</p><h2>Um sistema completo<br /><em>e pronto para usar.</em></h2></div><p>Organize sua vida financeira de forma prática, visual e personalizada.</p></div><div className="fj-preview-grid"><Preview label="Contas, entradas e saídas" /><Preview label="Despesas e compras parceladas" /></div><ul className="fj-areas">{areas.map((area,i)=><li key={area}><span>0{i+1}</span>{area}</li>)}</ul><p className="fj-caption">Capturas reais do template com dados demonstrativos. Selecione uma imagem para ampliar.</p></section>
      <section className="fj-freedom fj-wrap" aria-labelledby="fj-freedom-title">
        <p className="fj-kicker">FEITO PARA SUA REALIDADE</p>
        <h2 id="fj-freedom-title">A estrutura está pronta.<br /><em>As regras são suas.</em></h2>
        <p className="fj-freedom-intro">Você começa com um sistema organizado e tem liberdade para transformar cada parte dele. Sem precisar construir tudo do zero.</p>
        <div className="fj-freedom-grid">{[
          ['Modifique', 'Personalize páginas, informações e categorias.'],
          ['Acrescente', 'Crie novos espaços e funcionalidades conforme precisar.'],
          ['Comece grátis', 'Não é necessário contratar um plano pago do Notion para o uso inicial previsto.'],
          ['Evolua', 'Adapte o sistema conforme suas necessidades mudarem.'],
        ].map(([title, text], i) => <article key={title}><span className="fj-freedom-number" aria-hidden="true">0{i + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        <p className="fj-freedom-note">A personalização acontece na sua própria cópia, depois de duplicar o template. O template custa R$ 47, em pagamento único; o plano gratuito do Notion é separado dessa compra. Recursos avançados podem exigir um plano pago e não estão incluídos nesta promessa de uso inicial.</p>
        <p className="fj-freedom-close">Você não precisa começar do zero.<br /><span>Precisa começar a ter controle.</span></p>
      </section>
      <section className="fj-included fj-wrap"><div><p className="fj-kicker">MEU DINHEIRO, MINHAS REGRAS</p><h2>O que você recebe.</h2><NotionLabel /><p>Um template digital com exemplos e orientações para começar.</p></div><div><ul>{included.map((item,i)=><li key={item}><span aria-hidden="true">{String(i+1).padStart(2,'0')}</span>{item}</li>)}</ul><p className="fj-disclaimer">Os registros são feitos por você. O template não movimenta dinheiro, não se conecta automaticamente aos bancos e não oferece consultoria financeira.</p></div></section>
      <section className="fj-closing"><div className="fj-wrap fj-offer-grid"><div><p className="fj-kicker">ORGANIZAÇÃO É UM COMEÇO.</p><h2>Seu dinheiro.<br /><em>Suas regras.</em></h2><p>Mais organização, clareza e autonomia para decidir seu próximo passo.</p><ol className="fj-steps">{[['Compre','Pague pelo link oficial do Mercado Pago. Depois, informe seu e-mail de entrega e o número da transação pelo WhatsApp.'],['Receba','Após a confirmação manual do pagamento aprovado, receba por e-mail as instruções de acesso em até 24 horas.'],['Duplique','Copie o template para seu espaço de trabalho no Notion e personalize.']].map(([title,text],i)=><li key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></div><SpotlightCard as="aside" className="fj-offer"><NotionLabel /><p className="fj-kicker">TEMPLATE NOTION</p><p className="fj-offer-name">Meu Dinheiro,<br />Minhas Regras</p><p className="fj-price">R$ 47<span>,00</span></p><a href={paymentLink} className="fj-cta fj-cta--light">Comprar agora — R$ 47 <span aria-hidden="true">↗</span></a><p className="fj-offer-details">Pagamento único · Produto digital<br />Requer conta no Notion.</p><p className="fj-stage-note">{manualServiceNotice}</p><p className="fj-offer-details">{manualDeliveryNotice}</p><a className="fj-delivery-link" href={deliveryContact}>Informar dados para entrega</a></SpotlightCard></div></section>
    </main><footer className="fj-footer fj-wrap"><Link to="/">RENATAJOIN</Link><span>Organização com personalidade. Feito no Brasil.</span><Link to="/produtos-digitais">Condições dos produtos digitais</Link></footer>
  </div>;
}
