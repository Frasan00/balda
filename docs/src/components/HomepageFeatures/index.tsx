import Heading from '@theme/Heading';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Cross-Runtime Support',
    Svg: require('@site/static/img/logo.svg').default,
    description: (
      <>
        Build once, run anywhere. Balda works seamlessly across Node.js, Bun,
        and Deno, letting you choose the runtime that fits your needs.
      </>
    ),
  },
  {
    title: 'Developer Experience First',
    Svg: require('@site/static/img/logo.svg').default,
    description: (
      <>
        Inspired by FastAPI, Balda provides an intuitive API with decorators,
        automatic validation, and powerful plugins to accelerate development.
      </>
    ),
  },
  {
    title: 'Production Ready',
    Svg: require('@site/static/img/logo.svg').default,
    description: (
      <>
        Built-in support for queues, cron jobs, middleware, and comprehensive
        testing utilities. Everything you need to build robust backend applications.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
